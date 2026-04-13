/**
 * /api/memory routes
 */
import express from 'express';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import database from '../../services/database.js';
import { promoteToGlobalMemory } from '../../services/globalMemory.js';

const router = express.Router();

// GET /global — list global memories
router.get('/global', asyncHandler(async (req, res) => {
  const { type, limit = '50' } = req.query;
  const parsedLimit = Math.min(parseInt(limit) || 50, 200);

  let rows;
  if (type) {
    rows = await database.all(
      'SELECT * FROM global_memory WHERE entity_type = ? ORDER BY confidence DESC LIMIT ?',
      [type, parsedLimit]
    );
  } else {
    rows = await database.all(
      'SELECT * FROM global_memory ORDER BY confidence DESC LIMIT ?',
      [parsedLimit]
    );
  }

  res.json({ success: true, memories: rows });
}));

// GET /search — search global memory
router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit = '20' } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'q parameter required' });
  if (q.length > 500) return res.status(400).json({ success: false, error: 'q too long (max 500 chars)' });

  // Wrap each token in double-quotes to suppress FTS5 operator interpretation.
  const sanitized = q.replace(/"/g, '').trim().split(/\s+/).filter(Boolean).map(t => `"${t}"`).join(' ');
  const results = await database.all(
    `SELECT gm.* FROM global_memory_fts fts
     JOIN global_memory gm ON gm.rowid = fts.rowid
     WHERE global_memory_fts MATCH ?
     ORDER BY rank LIMIT ?`,
    [sanitized, parseInt(limit) || 20]
  );
  res.json({ success: true, results });
}));

// PUT /global/:id — edit a memory entry
router.put('/global/:id', asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ success: false, error: 'content required' });
  if (typeof content !== 'string' || content.length > 5000) {
    return res.status(400).json({ success: false, error: 'content must be a string ≤ 5000 characters' });
  }

  await database.run(
    'UPDATE global_memory SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [content, req.params.id]
  );
  const updated = await database.get('SELECT * FROM global_memory WHERE id = ?', [req.params.id]);
  if (!updated) throw new NotFoundError('Memory entry not found');
  res.json({ success: true, memory: updated });
}));

// DELETE /global/:id — delete a memory entry
router.delete('/global/:id', asyncHandler(async (req, res) => {
  const row = await database.get('SELECT id FROM global_memory WHERE id = ?', [req.params.id]);
  if (!row) throw new NotFoundError('Memory entry not found');
  await database.run('DELETE FROM global_memory WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// POST /promote/:sessionId — promote session memory to global
router.post('/promote/:sessionId', asyncHandler(async (req, res) => {
  const session = await database.get('SELECT * FROM sessions WHERE id = ?', [req.params.sessionId]);
  if (!session) throw new NotFoundError('Session not found');

  const facts = session.extracted_facts ? JSON.parse(session.extracted_facts) : [];
  const summary = session.rolling_summary || '';
  await promoteToGlobalMemory(req.params.sessionId, facts, summary);
  res.json({ success: true });
}));

// GET /relationships — list all character relationships
router.get('/relationships', asyncHandler(async (_req, res) => {
  const rows = await database.all(
    'SELECT * FROM character_relationships ORDER BY updated_at DESC'
  );
  res.json({ success: true, relationships: rows });
}));

// GET /relationships/:charName — get specific relationship
router.get('/relationships/:charName', asyncHandler(async (req, res) => {
  const row = await database.get(
    'SELECT * FROM character_relationships WHERE character_name = ?',
    [req.params.charName]
  );
  if (!row) throw new NotFoundError('Relationship not found');
  res.json({ success: true, relationship: row });
}));

export default router;
