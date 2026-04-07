import { getActive, setActive } from './worldManager.js';

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
   * @param {Object} settings
   */
  setAll(settings) {
    this._settings = settings;
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
        selectedModel: process.env.OLLAMA_CHAT_MODEL || 'llama3.2',
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
