/**
 * System commands: /help, /exit, /status
 */

export function register(registry) {
  registry.register({
    name: '/clear',
    aliases: [],
    description: 'Clear the screen without ending the session',
    usage: '/clear',
    handler: async (_args, _context) => {
      return { output: '', action: 'clear' };
    }
  });

  registry.register({
    name: '/help',
    aliases: ['/?'],
    description: 'Show available commands',
    usage: '/help',
    handler: async (_args, _context) => {
      return registry.getHelp();
    }
  });

  registry.register({
    name: '/exit',
    aliases: ['/quit'],
    description: 'Exit oread',
    usage: '/exit',
    handler: async (_args, _context) => {
      process.exit(0);
    }
  });

  registry.register({
    name: '/status',
    aliases: [],
    description: 'Show full current status',
    usage: '/status',
    handler: async (_args, context) => {
      const session = await context.sessionManager.getCurrentSession();
      const settings = context.settingsManager.getAll();
      const model = settings?.general?.selectedModel || 'none';
      const mode = settings?.mode || 'normal';
      const worldName = settings?.name || settings?.roleplay?.world?.name || 'none';
      const extractionStatus = context.extractionModelManager.getStatus();

      // Memory stats from session
      let factCount = 0;
      let hasSummary = false;
      let hasWorldState = false;
      if (session) {
        try { factCount = JSON.parse(session.extracted_facts || '[]').length; } catch { /* */ }
        hasSummary = !!session.rolling_summary;
        try { hasWorldState = Object.keys(JSON.parse(session.world_state || '{}')).length > 0; } catch { /* */ }
      }

      const loaded = settings?.roleplay?._loadedCharacters || [];
      const allChars = settings?.roleplay?.characters || [];
      const defaultChar = loaded[0]?.name || 'none';
      const supportChars = allChars
        .filter(c => c.name && c.name !== defaultChar)
        .map(c => c.name)
        .join(', ') || 'none';

      const lines = [
        '─── World ───────────────────────────',
        `  Name:      ${worldName}`,
        `  Mode:      ${mode}`,
        `  Character: ${defaultChar}`,
        `  Support:   ${supportChars}`,
        '',
        '─── Session ─────────────────────────',
        session
          ? `  Name:    ${session.name}\n  ID:      ${session.id.slice(0, 8)}...\n  Messages: ${session.message_count}`
          : '  No active session',
        '',
        '─── Model ───────────────────────────',
        `  Active:  ${model}`,
        `  Extract: ${extractionStatus.model} (${extractionStatus.status})`,
        '',
        '─── Memory ──────────────────────────',
        `  Facts:      ${factCount}`,
        `  Summary:    ${hasSummary ? 'yes' : 'none'}`,
        `  World state: ${hasWorldState ? 'yes' : 'none'}`,
        `  Auto-summarize:    ${settings?.general?.autoSummarize !== false ? 'on' : 'off'}`,
        `  Cross-session mem: ${settings?.general?.crossSessionMemory !== false ? 'on' : 'off'}`,
      ];

      return lines.join('\n');
    }
  });
}
