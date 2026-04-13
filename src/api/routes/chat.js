/**
 * POST /api/chat — SSE streaming chat endpoint.
 * Thin wrapper over runChatTurn from the core engine.
 */
import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { runChatTurn } from '../../core/chatPipeline.js';
import { context } from '../../core/engine.js';

const router = express.Router();

router.post('/', asyncHandler(async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'message is required' });
  }
  if (message.length > 32000) {
    return res.status(400).json({ success: false, error: 'message too long (max 32000 chars)' });
  }

  // Validate sessionId is a proper UUID before using it.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (sessionId && !UUID_RE.test(sessionId)) {
    return res.status(400).json({ success: false, error: 'Invalid sessionId format' });
  }

  // If a sessionId is provided, switch to that session
  if (sessionId) {
    await context.sessionManager.switchSession(sessionId);
  }

  // Ensure there's an active session
  let session = await context.sessionManager.getCurrentSession();
  if (!session) {
    session = await context.sessionManager.createSession(
      'API Session',
      context.settingsManager.getAll()
    );
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let fullResponse = '';

    for await (const chunk of runChatTurn({ userMessage: message, context })) {
      fullResponse += chunk;
      sendEvent({ type: 'chunk', content: chunk });
    }

    sendEvent({ type: 'done', content: fullResponse });
  } catch (err) {
    // Log full error server-side; send only a generic message to the client.
    console.error('[api/chat] stream error:', err.message);
    sendEvent({ type: 'error', error: 'An error occurred during the chat request.' });
  } finally {
    res.end();
  }
}));

export default router;
