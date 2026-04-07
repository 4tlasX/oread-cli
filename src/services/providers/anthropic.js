/**
 * Anthropic (Claude) provider adapter.
 * Requires @anthropic-ai/sdk.
 * Yields chunks in the same { message: { content } } shape as the Ollama adapter.
 */
import Anthropic from '@anthropic-ai/sdk';

export const name = 'anthropic';

function getClient(apiKey) {
  return new Anthropic({ apiKey });
}

/**
 * Convert the internal messages format to Anthropic's format.
 * Strips the system message (passed separately) and converts roles.
 */
function convertMessages(messages) {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
}

export async function* chat(model, messages, options = {}, apiKey) {
  const { systemPrompt, temperature = 0.8, maxTokens = 2048 } = options;

  const client = getClient(apiKey);
  const anthropicMessages = convertMessages(messages);

  const stream = await client.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt || undefined,
    messages: anthropicMessages,
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta'
    ) {
      yield { message: { content: event.delta.text } };
    }
  }
}

export async function listModels(apiKey) {
  const client = getClient(apiKey);
  try {
    const response = await client.models.list();
    return (response.data || []).map(m => ({
      id: m.id,
      provider: 'anthropic',
      name: m.display_name || m.id,
    }));
  } catch {
    // Fallback: return well-known models
    return [
      { id: 'claude-opus-4-6', provider: 'anthropic', name: 'Claude Opus 4.6' },
      { id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', name: 'Claude Haiku 4.5' },
    ];
  }
}
