import database from '../services/database.js';
import extractionModelManager from '../services/extractionModelManager.js';
import * as worldManager from '../world/worldManager.js';
import settingsManager from '../world/settingsManager.js';
import sessionManager from '../session/sessionManager.js';

/**
 * Shared context object — populated by initialize()
 */
export const context = {
  database: null,
  extractionModelManager: null,
  worldManager: null,
  settingsManager: null,
  sessionManager: null,
};

let _initialized = false;

/**
 * Initialize all services and populate the context object.
 * Safe to call multiple times.
 */
export async function initialize() {
  if (_initialized) return context;

  // Initialize database
  await database.initialize();

  // Load settings from disk
  settingsManager.load();

  // Initialize extraction model (downloads in background if missing)
  extractionModelManager.initialize().catch(err => {
    console.error('Extraction model initialization error:', err.message);
  });

  // Populate context
  context.database = database;
  context.extractionModelManager = extractionModelManager;
  context.worldManager = worldManager;
  context.settingsManager = settingsManager;
  context.sessionManager = sessionManager;

  // Ensure there is at least one session
  const sessions = await sessionManager.listSessions();
  if (sessions.length === 0) {
    const settings = settingsManager.getAll();
    await sessionManager.createSession('Default Session', settings);
  } else {
    // Switch to most recently updated session
    sessionManager.switchSession(sessions[0].id);
  }

  _initialized = true;
  return context;
}
