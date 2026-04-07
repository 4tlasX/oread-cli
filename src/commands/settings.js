/**
 * Settings commands: /settings, /set
 */

export function register(registry) {
  registry.register({
    name: '/settings',
    aliases: ['/config'],
    description: 'Show current settings. Pass a key path to inspect a specific value.',
    usage: '/settings [key.path]',
    handler: async (args, context) => {
      const settings = context.settingsManager.getAll();
      if (!settings) return 'No settings loaded.';

      if (args.length) {
        const value = context.settingsManager.get(args[0]);
        if (value === undefined) return `No setting found at "${args[0]}".`;
        return `${args[0]} = ${JSON.stringify(value, null, 2)}`;
      }

      // Show summary of key settings
      const g = settings.general || {};
      const lines = [
        'Current settings:\n',
        `  mode:                   ${settings.mode || 'normal'}`,
        `  general.selectedModel:  ${g.selectedModel || '(none)'}`,
        `  general.temperature:    ${g.temperature ?? 0.8}`,
        `  general.topP:           ${g.topP ?? 0.9}`,
        `  general.maxTokens:      ${g.maxTokens ?? 2048}`,
        `  general.contextBudget:  ${g.contextBudget ?? 4096}`,
        `  general.autoSummarize:  ${g.autoSummarize ?? true}`,
        `  general.crossSessionMemory: ${g.crossSessionMemory ?? true}`,
        `  general.webSearch:      ${g.webSearch ?? false}`,
        '',
        'Use /settings <key.path> to inspect nested values.',
        'Use /set <key.path> <value> to change a setting.',
      ];
      return lines.join('\n');
    }
  });

  registry.register({
    name: '/set',
    aliases: [],
    description: 'Change a setting by dot-separated key path.',
    usage: '/set <key.path> <value>',
    handler: async (args, context) => {
      if (args.length < 2) return 'Usage: /set <key.path> <value>';

      const keyPath = args[0];
      const rawValue = args.slice(1).join(' ');

      // Coerce value types
      let value;
      if (rawValue === 'true') value = true;
      else if (rawValue === 'false') value = false;
      else if (rawValue === 'null') value = null;
      else if (!isNaN(Number(rawValue)) && rawValue !== '') value = Number(rawValue);
      else value = rawValue;

      context.settingsManager.set(keyPath, value);
      return `Set ${keyPath} = ${JSON.stringify(value)}`;
    }
  });
}
