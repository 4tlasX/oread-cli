/**
 * Notes command: /notes [show|set <text>|clear]
 */
import database from '../services/database.js';

export function register(registry) {
  registry.register({
    name: '/notes',
    aliases: [],
    description: 'View or set story/session notes. /notes set <text> to write, /notes clear to erase.',
    usage: '/notes [set <text> | clear]',
    handler: async (args, context) => {
      const session = await context.sessionManager.getCurrentSession();
      if (!session) return 'No active session.';

      const subcommand = args[0];

      if (!subcommand || subcommand === 'show') {
        if (!session.story_notes) return 'No notes for this session. Use /notes set <text> to add some.';
        return `Notes:\n\n${session.story_notes}`;
      }

      if (subcommand === 'clear') {
        await database.run(
          `UPDATE sessions SET story_notes = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [session.id]
        );
        return 'Notes cleared.';
      }

      if (subcommand === 'set') {
        const text = args.slice(1).join(' ');
        if (!text) return 'Usage: /notes set <text>';
        await database.run(
          `UPDATE sessions SET story_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [text, session.id]
        );
        return 'Notes saved.';
      }

      // Treat anything else as /notes set shorthand (all args are the note text)
      const text = args.join(' ');
      await database.run(
        `UPDATE sessions SET story_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [text, session.id]
      );
      return 'Notes saved.';
    }
  });
}
