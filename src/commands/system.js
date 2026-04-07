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
      const defaultChar = loaded[0]?.name || '—';
      const supportChars = allChars
        .filter(c => c.name && c.name !== defaultChar)
        .map(c => c.name)
        .join(', ') || '—';

      // Format a section: { title, rows: [[key, value], ...] }
      // Keys are right-padded to the longest key in the section for tight alignment.
      const section = (title, rows) => {
        const width = Math.max(...rows.map(([k]) => k.length));
        const body = rows.map(([k, v]) => `  ${k.padEnd(width)}   ${v}`);
        return [title, ...body].join('\n');
      };

      const blocks = [
        section('World', [
          ['name',      worldName],
          ['mode',      mode],
          ['character', defaultChar],
          ['support',   supportChars],
        ]),
        session
          ? section('Session', [
              ['name',     session.name],
              ['id',       session.id.slice(0, 8)],
              ['messages', String(session.message_count)],
            ])
          : 'Session\n  no active session',
        section('Model', [
          ['active',  model],
          ['extract', `${extractionStatus.model} (${extractionStatus.status})`],
        ]),
        section('Memory', [
          ['facts',          String(factCount)],
          ['summary',        hasSummary ? 'yes' : '—'],
          ['world state',    hasWorldState ? 'yes' : '—'],
          ['auto-summarize', settings?.general?.autoSummarize !== false ? 'on' : 'off'],
          ['cross-session',  settings?.general?.crossSessionMemory !== false ? 'on' : 'off'],
        ]),
      ];

      return blocks.join('\n\n');
    }
  });
}
