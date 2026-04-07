/**
 * /api/sessions routes — adapted from chat/routes/sessions.js
 */
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import database from '../../services/database.js';
import { searchMessages } from '../../services/memorySearch.js';
import { createWorldSnapshot, getWorldSnapshot, seedWorldState } from '../../services/worldSnapshotService.js';

const router = express.Router();

// POST / — create session
router.post('/', asyncHandler(async (req, res) => {
  const { name, character_name, character_mode, mode = 'normal', settings_snapshot } = req.body;
  const sessionId = uuidv4();

  let initialWorldState = '{}';
  if (settings_snapshot?.general?.crossSessionMemory !== false) {
    try {
      const templateId = settings_snapshot?.meta?.templateId || 'default';
      const snapshot = await getWorldSnapshot(templateId, character_name || null);
      if (snapshot) initialWorldState = JSON.stringify(seedWorldState(snapshot));
    } catch { /* non-fatal */ }
  }

  await database.run(
    `INSERT INTO sessions (id, name, character_name, character_mode, mode, settings_snapshot, world_state)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, name || 'New Session', character_name || null, character_mode || 'single',
     mode, settings_snapshot ? JSON.stringify(settings_snapshot) : null, initialWorldState]
  );

  const session = await database.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  res.json({ success: true, session });
}));

// GET / — list sessions
router.get('/', asyncHandler(async (req, res) => {
  const { archived = 'false', limit = '50', offset = '0' } = req.query;
  const parsedLimit = Math.min(parseInt(limit) || 50, 100);
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);
  const isArchived = archived === 'true' ? 1 : 0;

  const sessions = await database.all(
    `SELECT * FROM sessions WHERE archived = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [isArchived, parsedLimit, parsedOffset]
  );
  const [{ count }] = await database.all(
    'SELECT COUNT(*) as count FROM sessions WHERE archived = ?', [isArchived]
  );

  res.json({ success: true, sessions, total: count, limit: parsedLimit, offset: parsedOffset });
}));

// GET /:id — get session
router.get('/:id', asyncHandler(async (req, res) => {
  const session = await database.get('SELECT * FROM sessions WHERE id = ?', [req.params.id]);
  if (!session) throw new NotFoundError('Session not found');
  res.json({ success: true, session });
}));

// PUT /:id — update session
router.put('/:id', asyncHandler(async (req, res) => {
  const { name, archived } = req.body;
  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (archived !== undefined) { updates.push('archived = ?'); params.push(archived ? 1 : 0); }

  if (!updates.length) return res.json({ success: true });

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.params.id);

  await database.run(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`, params);
  const session = await database.get('SELECT * FROM sessions WHERE id = ?', [req.params.id]);
  res.json({ success: true, session });
}));

// DELETE /:id — delete session
router.delete('/:id', asyncHandler(async (req, res) => {
  const session = await database.get('SELECT id FROM sessions WHERE id = ?', [req.params.id]);
  if (!session) throw new NotFoundError('Session not found');
  await database.run('DELETE FROM sessions WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// GET /:id/messages — list messages
router.get('/:id/messages', asyncHandler(async (req, res) => {
  const { limit = '100', offset = '0' } = req.query;
  const parsedLimit = Math.min(parseInt(limit) || 100, 500);
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);

  const messages = await database.all(
    `SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?`,
    [req.params.id, parsedLimit, parsedOffset]
  );
  res.json({ success: true, messages });
}));

// GET /:id/notes — get story notes
router.get('/:id/notes', asyncHandler(async (req, res) => {
  const session = await database.get('SELECT story_notes FROM sessions WHERE id = ?', [req.params.id]);
  if (!session) throw new NotFoundError('Session not found');
  res.json({ success: true, notes: session.story_notes || '' });
}));

// PUT /:id/notes — save story notes
router.put('/:id/notes', asyncHandler(async (req, res) => {
  const { notes } = req.body;
  await database.run(
    'UPDATE sessions SET story_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [notes || '', req.params.id]
  );
  res.json({ success: true });
}));

// GET /:id/world-state — get world state
router.get('/:id/world-state', asyncHandler(async (req, res) => {
  const session = await database.get(
    'SELECT world_state, world_state_history, character_stances FROM sessions WHERE id = ?',
    [req.params.id]
  );
  if (!session) throw new NotFoundError('Session not found');

  let worldState = {};
  let history = [];
  let stances = {};
  try { worldState = JSON.parse(session.world_state || '{}'); } catch { /* */ }
  try { history = JSON.parse(session.world_state_history || '[]'); } catch { /* */ }
  try { stances = JSON.parse(session.character_stances || '{}'); } catch { /* */ }

  res.json({ success: true, worldState, history, characterStances: stances });
}));

// GET /:id/search — FTS5 message search
router.get('/:id/search', asyncHandler(async (req, res) => {
  const { q, limit = '10' } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'q parameter required' });

  const results = await searchMessages(req.params.id, q, { limit: parseInt(limit) || 10 });
  res.json({ success: true, results });
}));

export default router;
