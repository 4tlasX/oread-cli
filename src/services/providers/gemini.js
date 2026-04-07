/**
 * Google Gemini provider adapter.
 * Requires @google/generative-ai.
 * Yields chunks in the same { message: { content } } shape as other adapters.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

export const name = 'gemini';

const FALLBACK_MODELS = [
  { id: 'gemini-2.5-pro', provider: 'gemini', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', provider: 'gemini', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', provider: 'gemini', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', provider: 'gemini', name: 'Gemini 2.0 Flash Lite' },
];

/**
 * Build a well-formed Gemini turn list from internal messages.
 *
 * Guarantees:
 *  - System prompt prepended to the first user turn
 *  - Consecutive same-role messages merged (Gemini requires strict alternation)
 *  - Leading 'model' turns dropped (history must start with 'user')
 *
 * Returns { history, userTurn } where history is all prior turns (ending on
 * 'model') and userTurn is the final user string to pass to sendMessageStream.
 */
function prepareGeminiMessages(messages, systemPrompt) {
  const turns = [];
  let pendingSystem = systemPrompt || null;

  for (const m of messages.filter(m => m.role !== 'system')) {
    const role = m.role === 'assistant' ? 'model' : 'user';

    let content = m.content;
    if (role === 'user' && pendingSystem) {
      content = pendingSystem + '\n\n' + content;
      pendingSystem = null;
    }

    if (turns.length && turns[turns.length - 1].role === role) {
      // Merge consecutive same-role turns
      turns[turns.length - 1].parts[0].text += '\n' + content;
    } else {
      turns.push({ role, parts: [{ text: content }] });
    }
  }

  // History must start with 'user'
  while (turns.length && turns[0].role === 'model') turns.shift();

  if (!turns.length) return { history: [], userTurn: '' };

  // The final turn must be the user message we're about to send
  // If the last turn is already 'model', there's nothing to send — bail
  const last = turns[turns.length - 1];
  if (last.role !== 'user') return { history: turns, userTurn: '' };

  const userTurn = last.parts[0].text;
  const history = turns.slice(0, -1);
  return { history, userTurn };
}

export async function* chat(model, messages, options = {}, apiKey) {
  const { systemPrompt, temperature = 0.8, maxTokens = 2048, topP = 0.9 } = options;

  const { history, userTurn } = prepareGeminiMessages(messages, systemPrompt);
  if (!userTurn) return;

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    generationConfig: { temperature, topP, maxOutputTokens: maxTokens },
  });

  const chatSession = geminiModel.startChat({ history });
  const result = await chatSession.sendMessageStream(userTurn);

  for await (const chunk of result.stream) {
    const text = chunk.text?.();
    if (text) yield { message: { content: text } };
  }
}

export async function listModels(apiKey) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // The SDK doesn't expose a listModels call, so return the known set
    return FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}
