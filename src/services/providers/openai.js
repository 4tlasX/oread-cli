/**
 * OpenAI provider adapter.
 * Requires openai npm package.
 * Yields chunks in the same { message: { content } } shape as the Ollama adapter.
 */
import OpenAI from 'openai';

export const name = 'openai';

function getClient(apiKey) {
  return new OpenAI({ apiKey });
}

function convertMessages(messages, systemPrompt) {
  const converted = [];
  if (systemPrompt) {
    converted.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages.filter(m => m.role !== 'system')) {
    converted.push({ role: m.role, content: m.content });
  }
  return converted;
}

export async function* chat(model, messages, options = {}, apiKey) {
  const { systemPrompt, temperature = 0.8, maxTokens = 2048, topP = 0.9 } = options;

  const client = getClient(apiKey);
  const openaiMessages = convertMessages(messages, systemPrompt);

  const stream = await client.chat.completions.create({
    model,
    messages: openaiMessages,
    temperature,
    max_tokens: maxTokens,
    top_p: topP,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      yield { message: { content } };
    }
  }
}

export async function listModels(apiKey) {
  const client = getClient(apiKey);
  try {
    const response = await client.models.list();
    const chatModels = (response.data || [])
      .filter(m => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'))
      .sort((a, b) => b.created - a.created)
      .slice(0, 20);
    return chatModels.map(m => ({ id: m.id, provider: 'openai' }));
  } catch {
    return [
      { id: 'gpt-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', provider: 'openai' },
      { id: 'gpt-4-turbo', provider: 'openai' },
    ];
  }
}
