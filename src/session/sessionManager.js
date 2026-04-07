import { v4 as uuidv4 } from 'uuid';
import database from '../services/database.js';

/**
 * Thin wrapper over DB for session management.
 * Tracks current session in memory.
 */
class SessionManager {
  constructor() {
    this._currentSessionId = null;
  }

  /**
   * Create a new session and switch to it.
   * @param {string} name - Session name
   * @param {Object} settings - Settings snapshot
   * @returns {Object} - The created session record
   */
  async createSession(name, settings = {}) {
    const id = uuidv4();
    const mode = settings?.mode || 'normal';
    const characterName = settings?.roleplay?._loadedCharacters?.[0]?.name || null;

    await database.run(
      `INSERT INTO sessions (id, name, character_name, mode, settings_snapshot)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, characterName, mode, JSON.stringify(settings)]
    );

    this._currentSessionId = id;
    return { id, name, mode, characterName };
  }

  /**
   * List all non-archived sessions, most recently updated first.
   * @returns {Array}
   */
  async listSessions() {
    return await database.all(
      `SELECT id, name, mode, character_name, message_count, created_at, updated_at
       FROM sessions
       WHERE archived = 0
       ORDER BY updated_at DESC`
    );
  }

  /**
   * Get the current session record.
   * @returns {Object|null}
   */
  async getCurrentSession() {
    if (!this._currentSessionId) return null;
    return await database.get(
      `SELECT * FROM sessions WHERE id = ?`,
      [this._currentSessionId]
    );
  }

  /**
   * Get the current session ID.
   * @returns {string|null}
   */
  getCurrentSessionId() {
    return this._currentSessionId;
  }

  /**
   * Switch to a different session by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  async switchSession(id) {
    const session = await database.get(
      `SELECT * FROM sessions WHERE id = ?`,
      [id]
    );
    if (!session) return null;
    this._currentSessionId = id;
    return session;
  }

  /**
   * Hard delete a session and all its messages.
   * @param {string} id
   */
  async deleteSession(id) {
    await database.run(`DELETE FROM messages WHERE session_id = ?`, [id]);
    await database.run(`DELETE FROM sessions WHERE id = ?`, [id]);
    if (this._currentSessionId === id) {
      this._currentSessionId = null;
    }
  }

  /**
   * Archive a session by ID.
   * @param {string} id
   */
  async archiveSession(id) {
    await database.run(
      `UPDATE sessions SET archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    if (this._currentSessionId === id) {
      this._currentSessionId = null;
    }
  }

  /**
   * Get messages for a session.
   * @param {string} sessionId
   * @returns {Array}
   */
  async getMessages(sessionId) {
    return await database.all(
      `SELECT role, content, pinned, timestamp FROM messages
       WHERE session_id = ?
       ORDER BY timestamp ASC`,
      [sessionId || this._currentSessionId]
    );
  }
}

export default new SessionManager();
