/**
 * Nomi.ai provider adapter.
 * Base URL: https://api.nomi.ai
 * Authentication: Authorization header with API key
 * API is synchronous - no streaming support.
 * Yields chunks in the same { message: { content } } shape as other providers.
 */
const BASE_URL = 'https://api.nomi.ai';

export const name = 'nomi';

export async function* chat(model, messages, options = {}, apiKey) {
  const nomiUuid = model.replace(/^nomi-/, '');

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
    const response = await fetch(`${BASE_URL}/v1/nomis/${nomiUuid}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messageText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const raw = errorData.errors?.issues?.[0]?.message || errorData.error || errorData.message || response.statusText;
      const errorType = typeof raw === 'string' ? raw : JSON.stringify(raw);
      throw new Error(`Nomi.ai API error: ${errorType}`);
    }

    const data = await response.json();
    const replyText = data.replyMessage?.text || '';

    if (replyText) {
      yield { message: { content: replyText } };
    }
  } catch (error) {
    if (error.message.includes('NoReply')) {
      yield { message: { content: '[Nomi did not respond. Please try again.]' } };
    } else if (error.message.includes('NomiNotReady')) {
      yield { message: { content: '[Nomi is still initializing. Please wait a moment and try again.]' } };
    } else if (error.message.includes('NomiStillResponding')) {
      yield { message: { content: '[Nomi is still responding to a previous message. Please wait.]' } };
    } else {
      throw error;
    }
  }
}

export async function listNomis(apiKey) {
  try {
    const response = await fetch(`${BASE_URL}/v1/nomis`, {
      headers: {
        'Authorization': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Nomi.ai API error: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.nomis || []).map(n => ({
      id: `nomi-${n.uuid}`,
      uuid: n.uuid,
      name: n.name,
      gender: n.gender,
      relationshipType: n.relationshipType,
      provider: 'nomi',
    }));
  } catch (error) {
    console.error('[nomi] Failed to list nomis:', error.message);
    return [];
  }
}

export async function listModels(apiKey) {
  const nomis = await listNomis(apiKey);
  if (nomis.length > 0) {
    return nomis;
  }
  const envId = process.env.NOMI_MODEL;
  if (envId) {
    return [{ id: `nomi-${envId}`, provider: 'nomi', name: `Nomi (${envId})` }];
  }
  return [
    { id: 'nomi-<nomi-uuid>', provider: 'nomi', name: 'Your Nomi (set NOMI_MODEL in .env)' },
  ];
}
