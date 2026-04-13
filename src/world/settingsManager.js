import { getActive, setActive } from './worldManager.js';

function getDefaultModel() {
  const kindroidId = process.env.KINDROID_MODEL;
  if (kindroidId) return `kindroid-${kindroidId}`;
  const nomiId = process.env.NOMI_MODEL;
  if (nomiId) return `nomi-${nomiId}`;
  return process.env.OLLAMA_CHAT_MODEL || 'llama3.2';
}

/**
 * In-memory settings manager with debounced persistence.
 */
class SettingsManager {
  constructor() {
    this._settings = null;
    this._debounceTimer = null;
    this._DEBOUNCE_MS = 1000;
  }

  /**
   * Load settings from disk into memory.
   */
  load() {
    this._settings = getActive() || this._defaultSettings();
    // If the saved model is a placeholder (contains angle brackets), replace with the
    // env-configured model so stale active.json values don't override the real ID.
    const saved = this._settings?.general?.selectedModel;
    if (saved && saved.includes('<') && saved.includes('>')) {
      if (this._settings.general) {
        this._settings.general.selectedModel = getDefaultModel();
      }
    }
  }

  /**
   * Get a settings value by dot-separated key path.
   * @param {string} keyPath - e.g. 'general.selectedModel' or 'mode'
   * @returns {*}
   */
  get(keyPath) {
    if (!this._settings) this.load();
    if (!keyPath) return this._settings;

    const parts = keyPath.split('.');
    let current = this._settings;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Set a settings value by dot-separated key path.
   * Schedules a debounced write to disk.
   * @param {string} keyPath
   * @param {*} value
   */
  set(keyPath, value) {
    if (!this._settings) this.load();

    const parts = keyPath.split('.');
    // Block prototype-pollution vectors before any traversal.
    const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);
    for (const part of parts) {
      if (DANGEROUS.has(part)) throw new Error(`Invalid key path: "${keyPath}"`);
    }

    let current = this._settings;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] == null) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;

    this._scheduleSave();
  }

  /**
   * Replace entire settings object.
   * JSON round-trip strips any __proto__ / constructor / prototype keys
   * that could cause prototype pollution if the caller passed untrusted input.
   * @param {Object} settings
   */
  setAll(settings) {
    this._settings = settings == null ? null : JSON.parse(JSON.stringify(settings));
    this._scheduleSave();
  }

  /**
   * Get the full settings object.
   */
  getAll() {
    if (!this._settings) this.load();
    return this._settings;
  }

  _scheduleSave() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      try {
        setActive(this._settings);
      } catch (e) {
        console.error('Failed to save settings:', e.message);
      }
    }, this._DEBOUNCE_MS);
  }

  _defaultSettings() {
    return {
      mode: 'normal',
      general: {
        selectedModel: getDefaultModel(),
        contextBudget: 4096,
        autoSummarize: true,
        crossSessionMemory: true
      },
      roleplay: {
        world: {
          settingLore: '',
          openingScene: '',
          narratorVoice: 'companion',
          hardRules: []
        },
        characterMode: 'single',
        _loadedCharacters: []
      },
      utility: {
        assistantIdentity: {
          persona: '',
          communicationStyle: ''
        },
        guardrails: {
          negativeConstraints: '',
          formattingPreferences: ''
        }
      },
      userPersona: {
        name: '',
        profession: '',
        bio: '',
        skills: '',
        timezone: '',
        linguisticFilters: {
          bannedWords: [],
          bannedPhrases: []
        }
      }
    };
  }
}

export default new SettingsManager();
