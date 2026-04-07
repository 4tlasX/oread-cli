/**
 * Ollama provider adapter.
 * Wraps the existing OllamaService to match the unified provider interface.
 */
import ollamaService from '../ollama.js';

export const name = 'ollama';

/**
 * Stream a chat completion from Ollama.
 * Yields chunks in the shape { message: { content: string } }
 */
export async function* chat(model, messages, options = {}) {
  const stream = await ollamaService.chat(model, messages, options);
  for await (const chunk of stream) {
    yield chunk;
  }
}

export async function listModels() {
  const result = await ollamaService.listModels();
  return (result.models || []).map(m => ({
    id: m.name,
    provider: 'ollama',
    size: m.size,
    modified: m.modified_at,
  }));
}

export function isAvailable() {
  return true; // Always available — Ollama is the local default
}
