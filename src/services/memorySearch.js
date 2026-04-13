/**
 * Hierarchical memory search using SQLite FTS5.
 * Provides full-text search over message archives and
 * zero-inference recall trigger detection.
 */

import database from './database.js';

/**
 * Search session message archive by keyword/phrase using FTS5.
 *
 * @param {string} sessionId - Session to search within
 * @param {string} query - Search terms
 * @param {Object} options
 * @param {number} options.limit - Max results (default 5)
 * @returns {Array<{role: string, content: string, timestamp: string}>}
 */
/** Maximum search query length — prevents large FTS5 scans. */
const MAX_QUERY_LEN = 500;

/**
 * Build a safe FTS5 MATCH expression from a user-supplied query.
 * Each whitespace-delimited token is wrapped in double-quotes, which
 * suppresses FTS5 operator interpretation (AND/OR/NOT/NEAR/*).
 */
function buildFtsQuery(raw) {
  const cleaned = raw.replace(/"/g, '').trim().slice(0, MAX_QUERY_LEN);
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  return tokens.map(t => `"${t}"`).join(' ');
}

export async function searchMessages(sessionId, query, { limit = 5 } = {}) {
  if (!query || typeof query !== 'string') return [];
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  try {
    const results = await database.all(
      `SELECT m.role, m.content, m.timestamp
       FROM messages_fts fts
       JOIN messages m ON m.rowid = fts.rowid
       WHERE messages_fts MATCH ? AND m.session_id = ?
       ORDER BY rank
       LIMIT ?`,
      [ftsQuery, sessionId, limit]
    );
    return results;
  } catch (err) {
    // Fallback to LIKE search if FTS5 fails
    console.error('FTS5 search failed, falling back to LIKE:', err.message);
    const safe = query.slice(0, MAX_QUERY_LEN).replace(/[%_\\]/g, '\\$&');
    return database.all(
      `SELECT role, content, timestamp FROM messages
       WHERE session_id = ? AND content LIKE ? ESCAPE '\\'
       ORDER BY timestamp DESC LIMIT ?`,
      [sessionId, `%${safe}%`, limit]
    );
  }
}

// Patterns that trigger archive recall
const RECALL_PATTERNS = [
  /remember when (.+?)(?:\?|$)/i,
  /earlier (?:you|we) (?:said|discussed|talked about) (.+?)(?:\?|$)/i,
  /what did (?:you|we) say about (.+?)(?:\?|$)/i,
  /you mentioned (.+?)(?:\?|$)/i,
  /back when (?:we|you) (.+?)(?:\?|$)/i,
  /do you recall (.+?)(?:\?|$)/i,
  /we (?:once|previously) (?:discussed|talked about) (.+?)(?:\?|$)/i,
  /(?:you|we) were talking about (.+?)(?:\?|$)/i,
];

/**
 * Detect if the current message references something that needs archive recall.
 * Zero-inference: pattern matching only.
 *
 * @param {string} userMessage - The user's message
 * @returns {{ needsRecall: boolean, searchTerms: string[] }}
 */
export function detectRecallTriggers(userMessage) {
  const searchTerms = [];

  for (const pattern of RECALL_PATTERNS) {
    const match = userMessage.match(pattern);
    if (match && match[1]) {
      const term = match[1].trim().replace(/[.!?,;]+$/, '');
      if (term.length >= 3 && term.length <= 100) {
        searchTerms.push(term);
      }
    }
  }

  return { needsRecall: searchTerms.length > 0, searchTerms };
}
