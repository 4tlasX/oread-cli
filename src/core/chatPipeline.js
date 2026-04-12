import { v4 as uuidv4 } from 'uuid';
import database from '../services/database.js';
import { chat as providerChat, detectProvider } from '../services/providers/index.js';
import { selectMessages } from '../services/contextWindow.js';
import { processPostChat } from '../services/postChatProcessor.js';
import { searchMessages, detectRecallTriggers } from '../services/memorySearch.js';
import { getRelevantGlobalMemories } from '../services/globalMemory.js';
import { buildSystemPrompt } from './promptBuilder.js';

const EXTERNAL_PROVIDERS = ['nomi', 'kindroid'];

/**
 * Save a message to the DB and increment the session message count.
 * @param {string} sessionId
 * @param {{ role: string, content: string }} message
 * @returns {string} - messageId
 */
async function saveMessageToSession(sessionId, message) {
  const messageId = uuidv4();
  const timestamp = message.timestamp || new Date().toISOString();

  await database.transaction(async () => {
    await database.run(
      `INSERT INTO messages (id, session_id, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [messageId, sessionId, message.role, message.content, timestamp]
    );

    await database.run(
      `UPDATE sessions
       SET message_count = message_count + 1,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sessionId]
    );
  });

  return messageId;
}

/**
 * Async generator that runs one full chat turn.
 * Yields each text chunk as it arrives from Ollama.
 * After the stream ends, saves both messages and fires post-processing.
 *
 * @param {Object} params
 * @param {string} params.userMessage - The user's plain text message
 * @param {Object} params.context - The engine context (database, sessionManager, settingsManager, etc.)
 */
export async function* runChatTurn({ userMessage, context }) {
  const { sessionManager, settingsManager } = context;

  const session = await sessionManager.getCurrentSession();
  if (!session) {
    throw new Error('No active session. Create one with /new');
  }
  const sessionId = session.id;
  const settings = settingsManager.getAll();
  const model = settings?.general?.selectedModel || process.env.OLLAMA_CHAT_MODEL || 'llama3.2';

  // Save user message first
  await saveMessageToSession(sessionId, {
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  });

  // Load all messages from DB
  const dbMessages = await database.all(
    `SELECT role, content, pinned FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
    [sessionId]
  );

  // Load session context data
  const dbSession = await database.get(
    `SELECT story_notes, extracted_facts, rolling_summary, world_state, world_state_history, character_stances FROM sessions WHERE id = ?`,
    [sessionId]
  );

  const storyNotes = dbSession?.story_notes || '';
  const rollingSummary = dbSession?.rolling_summary || '';
  let worldStateData = {};
  try { worldStateData = JSON.parse(dbSession?.world_state || '{}'); } catch (e) { /* */ }
  let worldStateHistory = [];
  try { worldStateHistory = JSON.parse(dbSession?.world_state_history || '[]'); } catch (e) { /* */ }
  let extractedFactsData = [];
  try { extractedFactsData = JSON.parse(dbSession?.extracted_facts || '[]'); } catch (e) { /* */ }
  let characterStancesData = {};
  try { characterStancesData = JSON.parse(dbSession?.character_stances || '{}'); } catch (e) { /* */ }

  const contextBudget = settings?.general?.contextBudget || 4096;
  const mode = settings?.mode || 'normal';
  const isExternalProvider = EXTERNAL_PROVIDERS.includes(detectProvider(model));

  // Build system prompt
  const isFirstMessage = dbMessages.filter(m => m.role === 'user').length === 1;
  const systemPrompt = isExternalProvider
    ? null // External providers (Nomi/Kindroid) have their own system prompts
    : buildSystemPrompt(settings, mode, isFirstMessage);

  // Check for recall triggers (skip for external providers - they handle their own memory)
  let recalledMessages = [];
  if (!isExternalProvider) {
    const { needsRecall, searchTerms } = detectRecallTriggers(userMessage);
    if (needsRecall) {
      for (const term of searchTerms) {
        const results = await searchMessages(sessionId, term, { limit: 3 });
        recalledMessages.push(...results);
      }
      // Deduplicate
      const seen = new Set();
      recalledMessages = recalledMessages.filter(m => {
        const key = m.content.substring(0, 100);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  }

  // Load cross-session global memory if enabled (skip for external providers)
  let globalContext = null;
  if (!isExternalProvider) {
    const crossSessionEnabled = settings?.general?.crossSessionMemory !== false;
    if (crossSessionEnabled) {
      const characterName = settings?.roleplay?.character?.name || settings?.roleplay?._loadedCharacters?.[0]?.name;
      const userName = settings?.userPersona?.name;
      if (characterName && userName) {
        try {
          const { memories, relationship } = await getRelevantGlobalMemories(
            characterName, userName, userMessage, { limit: 10 }
          );
          if (relationship || memories.length > 0) {
            globalContext = { memories, relationship, userName };
          }
        } catch (err) {
          console.error('Global memory load error:', err);
        }
      }
    }
  }

  // Run context window selection (skip complex context for external providers)
  const { messages: windowedMessages, contextBlock } = selectMessages({
    messages: dbMessages.map(m => ({ role: m.role, content: m.content, pinned: !!m.pinned })),
    systemPrompt: systemPrompt || '',
    storyNotes: isExternalProvider ? storyNotes : storyNotes,
    extractedFacts: isExternalProvider ? [] : extractedFactsData,
    contextBudget,
    rollingSummary: isExternalProvider ? '' : rollingSummary,
    worldState: isExternalProvider ? {} : worldStateData,
    worldStateHistory: isExternalProvider ? [] : worldStateHistory,
    characterStances: isExternalProvider ? {} : characterStancesData,
    recalledMessages,
    globalContext,
    mode
  });

  // Build final system prompt with context block appended
  let finalSystemPrompt = systemPrompt;
  if (contextBlock) {
    finalSystemPrompt = (systemPrompt || '') + '\n\n' + contextBlock;
  }

  // Stream from the appropriate provider (Ollama, Anthropic, OpenAI)
  const stream = providerChat(model, windowedMessages, {
    systemPrompt: finalSystemPrompt,
    temperature: settings?.general?.temperature,
    topP: settings?.general?.topP,
    maxTokens: settings?.general?.maxTokens
  });

  let assistantResponse = '';

  for await (const chunk of stream) {
    if (chunk.message?.content) {
      assistantResponse += chunk.message.content;
      yield chunk.message.content;
    }
  }

  // Save assistant message
  await saveMessageToSession(sessionId, {
    role: 'assistant',
    content: assistantResponse,
    timestamp: new Date().toISOString()
  });

  // Fire post-chat processing (fire-and-forget)
  // Skip for external providers - they handle their own memory
  if (!isExternalProvider) {
    setImmediate(() => {
      processPostChat({
        sessionId,
        userContent: userMessage,
        assistantResponse,
        model,
        settings,
        isDevelopment: process.env.NODE_ENV === 'development'
      }).catch(err => console.error('postChatProcessor error:', err));
    });
  }
}
