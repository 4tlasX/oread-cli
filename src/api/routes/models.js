/**
 * /api/models routes
 */
import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { listAllModels } from '../../services/providers/index.js';
import ollamaService from '../../services/ollama.js';

const router = express.Router();

// GET / — list all models from all configured providers
router.get('/', asyncHandler(async (_req, res) => {
  const models = await listAllModels();
  res.json({ success: true, models });
}));

// POST /pull — pull an Ollama model (SSE progress)
router.post('/pull', asyncHandler(async (req, res) => {
  const { modelName } = req.body;
  if (!modelName) return res.status(400).json({ success: false, error: 'modelName required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const stream = await ollamaService.pullModel(modelName);
    for await (const progress of stream) {
      sendEvent({ type: 'progress', ...progress });
    }
    sendEvent({ type: 'done', modelName });
  } catch (err) {
    sendEvent({ type: 'error', error: err.message });
  } finally {
    res.end();
  }
}));

export default router;
