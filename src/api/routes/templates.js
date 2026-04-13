/**
 * /api/templates routes — worlds/settings management
 */
import express from 'express';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { context } from '../../core/engine.js';

const router = express.Router();

// GET / — list all templates (defaults + user)
router.get('/', asyncHandler(async (_req, res) => {
  const worlds = await context.worldManager.listWorlds();
  res.json({ success: true, templates: worlds });
}));

// GET /active — get active settings
router.get('/active', asyncHandler(async (_req, res) => {
  const settings = context.settingsManager.getAll();
  res.json({ success: true, settings });
}));

// PUT /active — save active settings
router.put('/active', asyncHandler(async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return res.status(400).json({ success: false, error: 'settings must be a plain object' });
  }
  // setAll() already does a JSON round-trip to strip prototype-polluting keys.
  context.settingsManager.setAll(settings);
  res.json({ success: true });
}));

// DELETE /active — reset to defaults
router.delete('/active', asyncHandler(async (_req, res) => {
  context.settingsManager.setAll(null);
  context.settingsManager.load();
  res.json({ success: true });
}));

// GET /:id — get a single template by id
router.get('/:id', asyncHandler(async (req, res) => {
  // loadWorld() validates the id internally; a null return means not found or invalid id.
  const world = await context.worldManager.loadWorld(req.params.id);
  if (!world) throw new NotFoundError('Template not found');
  res.json({ success: true, template: world });
}));

// POST /user — save a new user template
router.post('/user', asyncHandler(async (req, res) => {
  const { settings, name } = req.body;
  if (!settings) return res.status(400).json({ success: false, error: 'settings required' });

  const saved = await context.worldManager.saveUserWorld(settings, name);
  res.json({ success: true, template: saved });
}));

// DELETE /user/:id — delete a user template
router.delete('/user/:id', asyncHandler(async (req, res) => {
  // deleteUserWorld() validates the id internally.
  const deleted = await context.worldManager.deleteUserWorld(req.params.id);
  if (!deleted) throw new NotFoundError('User template not found');
  res.json({ success: true });
}));

export default router;
