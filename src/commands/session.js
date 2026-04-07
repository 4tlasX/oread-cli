/**
 * Session commands: /sessions, /session [id-or-name], /new [name]
 */

export function register(registry) {
  registry.register({
    name: '/sessions',
    aliases: ['/ls'],
    description: 'List all sessions',
    usage: '/sessions',
    getDynamicArgs: async (context) => {
      const sessions = await context.sessionManager.listSessions();
      const currentId = context.sessionManager.getCurrentSessionId();
      return sessions.map(s => ({
        name: s.id.slice(0, 8),
        description: s.name + (s.id === currentId ? '  ◀' : ''),
        resolvedCommand: `/session ${s.id.slice(0, 8)}`,
      }));
    },
    handler: async (_args, context) => {
      const sessions = await context.sessionManager.listSessions();
      if (sessions.length === 0) return 'No sessions found. Use /new to create one.';

      const currentId = context.sessionManager.getCurrentSessionId();
      const lines = sessions.map(s => {
        const active = s.id === currentId ? ' ◀' : '  ';
        const id = s.id.slice(0, 8);
        const msgs = `${s.message_count} msg${s.message_count !== 1 ? 's' : ''}`;
        const date = s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '';
        return `${active} ${id}  ${s.name.padEnd(28)}  ${msgs.padEnd(10)}${date}`;
      });
      return `Sessions:\n\n${lines.join('\n')}`;
    }
  });

  registry.register({
    name: '/session',
    aliases: [],
    description: 'Show, switch, or delete sessions. Subcommands: delete <name-or-id>',
    usage: '/session [delete <name-or-id> | <id-or-name>]',
    subcommands: [
      { name: 'delete', description: 'Delete a session by name or ID' },
    ],
    getDynamicArgs: async (context, subcommand) => {
      const sessions = await context.sessionManager.listSessions();
      const currentId = context.sessionManager.getCurrentSessionId();
      return sessions
        .filter(s => subcommand === 'delete' ? s.id !== currentId : true)
        .map(s => ({ name: s.id.slice(0, 8), description: s.name }));
    },
    handler: async (args, context) => {
      // /session delete <name-or-id>
      if (args[0] === 'delete') {
        const query = args.slice(1).join(' ').toLowerCase();
        if (!query) return 'Usage: /session delete <name-or-id>';

        const sessions = await context.sessionManager.listSessions();
        const match =
          sessions.find(s => s.id.startsWith(query)) ||
          sessions.find(s => s.name.toLowerCase().includes(query));

        if (!match) return `No session found matching "${args.slice(1).join(' ')}"\nUse /sessions to list all.`;

        const currentId = context.sessionManager.getCurrentSessionId();
        if (match.id === currentId) return `Cannot delete the active session. Switch to another first.`;

        await context.sessionManager.deleteSession(match.id);
        return `Deleted session: ${match.name} (${match.id.slice(0, 8)}...)`;
      }

      if (!args.length) {
        // No args — show current session detail
        const session = await context.sessionManager.getCurrentSession();
        if (!session) return 'No active session. Use /new to create one.';
        const lines = [
          `Session: ${session.name}`,
          `ID:      ${session.id}`,
          `Mode:    ${session.mode}`,
          `Messages: ${session.message_count}`,
          `Created: ${session.created_at}`,
          `Updated: ${session.updated_at}`,
        ];
        return lines.join('\n');
      }

      const query = args.join(' ').toLowerCase();
      const sessions = await context.sessionManager.listSessions();

      // Match by ID prefix first, then by name substring
      const match =
        sessions.find(s => s.id.startsWith(query)) ||
        sessions.find(s => s.name.toLowerCase().includes(query));

      if (!match) return `No session found matching "${args.join(' ')}"\nUse /sessions to list all.`;

      await context.sessionManager.switchSession(match.id);
      return `Switched to: ${match.name} (${match.id.slice(0, 8)}...)  ${match.message_count} messages`;
    }
  });

  registry.register({
    name: '/new',
    aliases: [],
    description: 'Create a new session with the current world settings',
    usage: '/new [session name]',
    handler: async (args, context) => {
      const name = args.length > 0 ? args.join(' ') : `Session ${new Date().toLocaleString()}`;
      const settings = context.settingsManager.getAll();
      const session = await context.sessionManager.createSession(name, settings);
      return `New session: ${session.name} (${session.id.slice(0, 8)}...)`;
    }
  });
}
