/**
 * Kindroid.ai provider adapter.
 * Base URL: https://api.kindroid.ai/v1
 * Authentication: Bearer token (API key starts with kn_)
 * API is synchronous - no streaming support.
 * Yields chunks in the same { message: { content } } shape as other providers.
 */
const BASE_URL = 'https://api.kindroid.ai/v1';

export const name = 'kindroid';

export async function* chat(model, messages, options = {}, apiKey) {
  const aiId = model.replace(/^kindroid-/, '');

  const conversationHistory = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role,
      text: typeof m.content === 'string' ? m.content : m.content?.[0]?.text || '',
    }));

  const messageText = conversationHistory.length > 0
    ? conversationHistory[conversationHistory.length - 1].text
    : '';

  if (!messageText) return;

  try {
    const response = await fetch(`${BASE_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ai_id: aiId,
        message: messageText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = response.statusText;
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.error || errorData.message || errorText;
      } catch {}
      throw new Error(`Kindroid.ai API error (${response.status}): ${errorMsg}`);
    }

    const raw = await response.text();
    let replyText = raw;
    try {
      const data = JSON.parse(raw);
      replyText = data.response || data.message || raw;
    } catch {
      // plain text response — use as-is
    }

    if (replyText) {
      yield { message: { content: replyText } };
    }
  } catch (error) {
    if (error.message.includes('401')) {
      yield { message: { content: '[Kindroid authentication failed. Check your API key.]' } };
    } else if (error.message.includes('403')) {
      yield { message: { content: '[Kindroid access forbidden. Check your account permissions.]' } };
    } else if (error.message.includes('400')) {
      yield { message: { content: `[Kindroid error: Bad Request. Check that KINDROID_MODEL is set to your actual AI ID (not "kindroid-<id>", just the ID part like "abc123").]` } };
    } else {
      throw error;
    }
  }
}

export async function listKindroids(apiKey) {
  const envId = process.env.KINDROID_MODEL;
  if (envId) {
    return [{ id: `kindroid-${envId}`, provider: 'kindroid', name: `Kindroid (${envId})` }];
  }
  return [
    { id: 'kindroid-<ai_id>', provider: 'kindroid', name: 'Your Kindroid (set KINDROID_MODEL in .env)' },
  ];
}

export async function listModels(apiKey) {
  return listKindroids(apiKey);
}
