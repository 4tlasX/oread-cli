/**
 * Shape-First memory provider.
 * Uses Cloudflare Workers AI native REST API to generate reasoning chain summaries.
 * Non-streaming — we want the full reasoning summary before storing it.
 *
 * Credentials are resolved automatically from existing CF env vars:
 *   CF_ACCOUNT_ID + CF_API_TOKEN  (same ones used for the @cf/* chat provider)
 *   SHAPEFIRST_MODEL              (optional override)
 *
 * Advanced: override via /key set shapefirst <gatewayUrl>|<apiKey>|<model>
 * (use this to route through an AI Gateway with an OpenAI-compatible endpoint)
 */

import { getKey } from '../keyStore.js';

const DEFAULT_MODEL = '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';
const CF_BASE = 'https://api.cloudflare.com/client/v4/accounts';

const SYSTEM_PROMPT = `You are a reasoning archivist. Read the conversation and produce a logic chain — a compressed record of how one thought led to the next.

The chain follows an anadiplosis pattern: each step picks up something from the step before it and carries it forward. The tail of one thought becomes the head of the next. Like this:

  "Because I listen. And when I listen, I learn. And when I learn, I grow."

Applied to a conversation:

  user felt responses were robotic
  ↳ robotic → AI over-acknowledged every message instead of engaging
  ↳ over-acknowledged → led to a forced restart attempt
  ↳ forced restart → user called it "blatantly awful"
  ↳ "blatantly awful" → exposed AI defaulting to apology loops
  ↳ apology loops → conversation shifted toward examining the memory system

Each ↳ line carries something forward from the line above — a word, a concept, a realization — and shows where it went next. The chain should read like a thread you can follow from beginning to end.

Compress aggressively. Capture the movement of thought, not just events — who pushed, who pulled, what shifted, what landed. No preamble, no explanation — output only the chain.`;

export async function resolveShapefirstKey() {
  // Advanced override: /key set shapefirst <gatewayUrl>|<apiKey>|<model>
  // Use this when routing through a CF AI Gateway with OpenAI-compatible endpoint
  const stored = await getKey('shapefirst');
  if (stored) {
    const parts = stored.split('|');
    if (parts.length >= 3) {
      return {
        mode: 'gateway',
        gatewayUrl: parts[0],
        apiKey: parts[1],
        model: parts.slice(2).join('|'),
      };
    }
  }

  // Auto-resolve from existing Cloudflare credentials — use native Workers AI API
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiKey = process.env.CF_API_TOKEN;
  if (accountId && apiKey) {
    return {
      mode: 'workers-ai',
      accountId,
      apiKey,
      model: process.env.SHAPEFIRST_MODEL || DEFAULT_MODEL,
    };
  }

  return null;
}

/**
 * Send recent turns + existing chains to CF Workers AI and get a reasoning summary.
 *
 * @param {Array<{role, content}>} recentTurns - Last 20 messages
 * @param {Array<string>} existingChains - Last 3 chain_text values for continuity
 * @param {Object} credentials - from resolveShapefirstKey()
 * @returns {Promise<string|null>}
 */
export async function summarizeWithGateway(recentTurns, existingChains, credentials) {
  const userContent = buildUserPrompt(recentTurns, existingChains);
  const { mode, apiKey, model } = credentials;

  let endpoint, body;

  if (mode === 'gateway') {
    // OpenAI-compatible format — for AI Gateway endpoints
    const base = credentials.gatewayUrl;
    endpoint = base.endsWith('/') ? `${base}chat/completions` : `${base}/chat/completions`;
    body = {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 512,
    };
  } else {
    // Native CF Workers AI REST API: POST /accounts/{id}/ai/run/{model}
    endpoint = `${CF_BASE}/${credentials.accountId}/ai/run/${model}`;
    body = {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1024,
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Shape-First error ${response.status}: ${err}`);
  }

  const data = await response.json();

  // Native CF Workers AI response: { result: { response: "..." }, success: true }
  // Gateway (OpenAI-compat) response: { choices: [{ message: { content: "..." } }] }
  let text = (
    data.result?.response ||
    data.choices?.[0]?.message?.content ||
    ''
  );

  // Strip <think>...</think> scratchpad blocks (DeepSeek R1 and similar reasoning models).
  // Handle both complete blocks and truncated ones (no closing tag = hit token limit mid-think).
  text = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // complete block
    .replace(/<think>[\s\S]*/i, '')             // truncated block (no closing tag)
    .trim();

  return text || null;
}

function buildUserPrompt(recentTurns, existingChains) {
  const parts = [];

  if (existingChains.length > 0) {
    parts.push('Previous reasoning chains (for context/continuity):');
    existingChains.forEach((c, i) => parts.push(`[Chain ${i + 1}]\n${c}`));
    parts.push('');
  }

  parts.push('Recent conversation to summarize:');
  recentTurns.forEach(m => {
    const label = m.role === 'user' ? 'User' : 'Assistant';
    const preview = m.content.length > 600 ? m.content.slice(0, 600) + '…' : m.content;
    parts.push(`${label}: ${preview}`);
  });

  parts.push('');
  parts.push('Summarize the reasoning trajectory of this conversation.');

  return parts.join('\n');
}
