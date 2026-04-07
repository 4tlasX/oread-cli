import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.env.OREAD_ROOT || path.resolve('.'), 'data');
const DEFAULTS_DIR = path.join(DATA_DIR, 'templates', 'defaults');
const USER_DIR = path.join(DATA_DIR, 'templates', 'user');
const ACTIVE_PATH = path.join(DATA_DIR, 'templates', 'active.json');

/**
 * List all available worlds from defaults, user, and optional env dir.
 * @returns {Array} - Array of { id, name, isUserTemplate, source }
 */
export function listWorlds() {
  const worlds = [];

  // Load from defaults
  if (fs.existsSync(DEFAULTS_DIR)) {
    for (const file of fs.readdirSync(DEFAULTS_DIR)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = fs.readFileSync(path.join(DEFAULTS_DIR, file), 'utf-8');
        const data = JSON.parse(raw);
        worlds.push({
          id: path.basename(file, '.json'),
          name: data.name || path.basename(file, '.json'),
          isUserTemplate: false,
          source: 'defaults'
        });
      } catch (e) {
        // skip invalid files
      }
    }
  }

  // Load from user templates
  if (fs.existsSync(USER_DIR)) {
    for (const file of fs.readdirSync(USER_DIR)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = fs.readFileSync(path.join(USER_DIR, file), 'utf-8');
        const data = JSON.parse(raw);
        worlds.push({
          id: path.basename(file, '.json'),
          name: data.name || path.basename(file, '.json'),
          isUserTemplate: true,
          source: 'user'
        });
      } catch (e) {
        // skip invalid files
      }
    }
  }

  // Load from optional env dir
  const envDir = process.env.CHAT_TEMPLATES_DIR;
  if (envDir && fs.existsSync(envDir)) {
    for (const file of fs.readdirSync(envDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = fs.readFileSync(path.join(envDir, file), 'utf-8');
        const data = JSON.parse(raw);
        worlds.push({
          id: path.basename(file, '.json'),
          name: data.name || path.basename(file, '.json'),
          isUserTemplate: false,
          source: 'env'
        });
      } catch (e) {
        // skip invalid files
      }
    }
  }

  return worlds;
}

/**
 * Load a world's full JSON by ID.
 * Searches defaults, then user dir, then env dir.
 * @param {string} id
 * @returns {Object|null}
 */
export function loadWorld(id) {
  const searchDirs = [DEFAULTS_DIR, USER_DIR];
  const envDir = process.env.CHAT_TEMPLATES_DIR;
  if (envDir) searchDirs.push(envDir);

  for (const dir of searchDirs) {
    const filePath = path.join(dir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        return null;
      }
    }
  }

  return null;
}

/**
 * Get the active world settings.
 * @returns {Object|null}
 */
export function getActive() {
  if (!fs.existsSync(ACTIVE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(ACTIVE_PATH, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * Set the active world settings.
 * @param {Object} settings
 */
export function setActive(settings) {
  const dir = path.dirname(ACTIVE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(ACTIVE_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Save a new user world template.
 * @param {Object} settings - Full settings object
 * @param {string} [name] - Optional display name override
 * @returns {Object} - The saved world object
 */
export function saveUserWorld(settings, name) {
  fs.mkdirSync(USER_DIR, { recursive: true });

  const displayName = name || settings?.name || 'My World';
  const baseId = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Avoid collisions
  let id = baseId;
  let counter = 2;
  while (fs.existsSync(path.join(USER_DIR, `${id}.json`))) {
    id = `${baseId}-${counter++}`;
  }

  const world = { id, name: displayName, settings };
  fs.writeFileSync(path.join(USER_DIR, `${id}.json`), JSON.stringify(world, null, 2), 'utf-8');
  return world;
}

/**
 * Delete a user world template by id.
 * @param {string} id
 * @returns {boolean} - true if deleted, false if not found
 */
export function deleteUserWorld(id) {
  const filePath = path.join(USER_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
