/**
 * Cloudflare Workers AI provider adapter.
 * Base URL: https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/{model}
 * Authentication: Authorization: Bearer <apiToken>
 * Credentials: stored as "accountId:apiToken" (combined string)
 * Model prefix: @cf/ (e.g. @cf/meta/llama-3.1-8b-instruct-fast)
 * Supports SSE streaming.
 */
const BASE_URL = 'https://api.cloudflare.com/client/v4/accounts';

export const name = 'cloudflare';

// Parse "accountId:apiToken" combined key string
function parseKey(apiKey) {
  const idx = apiKey.indexOf(':');
  if (idx === -1) throw new Error('Cloudflare key must be in format accountId:apiToken');
  return { accountId: apiKey.slice(0, idx), token: apiKey.slice(idx + 1) };
}

// Cloudflare requires strictly alternating user/assistant roles.
// Drop system-role gap markers (informational only) and merge any
// consecutive same-role messages that slip through after context selection.
function enforceAlternation(messages) {
  const filtered = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  const result = [];
  for (const msg of filtered) {
    if (result.length > 0 && result[result.length - 1].role === msg.role) {
      result[result.length - 1].content += '\n\n' + msg.content;
    } else {
      result.push({ ...msg });
    }
  }
  return result;
}

export async function* chat(model, messages, options = {}, apiKey) {
  const { accountId, token } = parseKey(apiKey);

  // Build OpenAI-compatible message array and enforce alternation
  const cfMessages = enforceAlternation(
    messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content?.[0]?.text || '',
    }))
  );

  const body = {
    messages: cfMessages,
    stream: true,
    ...(options.temperature != null && { temperature: options.temperature }),
    ...(options.max_tokens != null && { max_tokens: options.max_tokens }),
  };

  const response = await fetch(`${BASE_URL}/${accountId}/ai/run/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Cloudflare AI error ${response.status}: ${err.errors?.[0]?.message || response.statusText}`);
  }

  // Parse SSE stream: each line is `data: {...}` or `data: [DONE]`
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.response ?? parsed.delta?.content ?? '';
        if (content) yield { message: { content } };
      } catch { /* skip malformed lines */ }
    }
  }
}

// Curated list of popular Cloudflare Workers AI text-generation models
const CLOUDFLARE_MODELS = [
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B (fast)' },
  { id: '@cf/meta/llama-3.1-8b-instruct-fast', name: 'Llama 3.1 8B (fast)' },
  { id: '@cf/meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
  { id: '@cf/meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B' },
  { id: '@cf/meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision' },
  { id: '@cf/mistral/mistral-7b-instruct-v0.2', name: 'Mistral 7B v0.2' },
  { id: '@cf/google/gemma-3-12b-it', name: 'Gemma 3 12B' },
  { id: '@cf/qwen/qwen2.5-72b-instruct', name: 'Qwen 2.5 72B' },
  { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill 32B' },
];

export async function listModels(_apiKey) {
  return CLOUDFLARE_MODELS.map(m => ({ ...m, provider: 'cloudflare' }));
}
