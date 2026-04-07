/**
 * Memory commands: /memory, /forget, /search
 */
import { searchMessages } from '../services/memorySearch.js';
import database from '../services/database.js';

export function register(registry) {
  registry.register({
    name: '/memory',
    aliases: ['/mem'],
    description: 'Show session memory: facts, summary, world state. /memory global for cross-session memory.',
    usage: '/memory [global]',
    handler: async (args, context) => {
      const global = args[0] === 'global';

      if (global) {
        const memories = await database.all(
          `SELECT entity_type, entity_key, content, confidence, access_count
           FROM global_memory
           ORDER BY confidence DESC, access_count DESC
           LIMIT 30`
        );
        if (!memories.length) return 'No global memory entries yet.';

        const lines = ['Global Memory:\n'];
        for (const m of memories) {
          lines.push(`[${m.entity_type}] ${m.entity_key}`);
          lines.push(`  ${m.content}`);
          lines.push(`  confidence: ${(m.confidence * 100).toFixed(0)}%  accessed: ${m.access_count}x`);
          lines.push('');
        }
        return lines.join('\n').trimEnd();
      }

      const session = await context.sessionManager.getCurrentSession();
      if (!session) return 'No active session.';

      const lines = [];

      // Rolling summary
      if (session.rolling_summary) {
        lines.push('Summary:');
        lines.push(session.rolling_summary);
        lines.push('');
      }

      // Extracted facts
      const facts = session.extracted_facts
        ? JSON.parse(session.extracted_facts)
        : [];
      if (facts.length) {
        lines.push(`Facts (${facts.length}):`);
        for (const f of facts) {
          const label = (f.type || f.category) ? `[${f.type || f.category}] ` : '';
          const text = f.text || f.content || (typeof f === 'string' ? f : JSON.stringify(f));
          lines.push(`  • ${label}${text}`);
        }
        lines.push('');
      }

      // World state
      const worldState = session.world_state
        ? JSON.parse(session.world_state)
        : null;
      if (worldState) {
        lines.push('World State:');
        if (worldState.currentLocation) lines.push(`  Location: ${worldState.currentLocation}`);
        if (worldState.timeOfDay) lines.push(`  Time: ${worldState.timeOfDay}`);
        if (worldState.mood) lines.push(`  Mood: ${worldState.mood}`);
        if (worldState.presentCharacters?.length) {
          lines.push(`  Characters: ${worldState.presentCharacters.join(', ')}`);
        }
        if (worldState.recentEvents?.length) {
          lines.push('  Recent events:');
          for (const e of worldState.recentEvents.slice(0, 5)) {
            const text = typeof e === 'string' ? e : e.text || JSON.stringify(e);
            lines.push(`    - ${text}`);
          }
        }
        lines.push('');
      }

      // Character stances
      const stances = session.character_stances
        ? JSON.parse(session.character_stances)
        : null;
      if (stances && Object.keys(stances).length) {
        lines.push('Stances:');
        for (const [char, stance] of Object.entries(stances)) {
          lines.push(`  ${char}: ${stance.currentMood || stance.opinion || JSON.stringify(stance)}`);
        }
        lines.push('');
      }

      if (!lines.length) return 'No memory recorded yet for this session.';
      return lines.join('\n').trimEnd();
    }
  });

  registry.register({
    name: '/forget',
    aliases: [],
    description: 'Remove a fact from session memory by text match.',
    usage: '/forget <text to match>',
    handler: async (args, context) => {
      if (!args.length) return 'Usage: /forget <text to match>';

      const session = await context.sessionManager.getCurrentSession();
      if (!session) return 'No active session.';

      const query = args.join(' ').toLowerCase();
      const facts = session.extracted_facts
        ? JSON.parse(session.extracted_facts)
        : [];

      const before = facts.length;
      const filtered = facts.filter(f => {
        const text = (f.text || f.content || (typeof f === 'string' ? f : '')).toLowerCase();
        return !text.includes(query);
      });

      if (filtered.length === before) return `No facts matched "${args.join(' ')}".`;

      await database.run(
        `UPDATE sessions SET extracted_facts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [JSON.stringify(filtered), session.id]
      );

      const removed = before - filtered.length;
      return `Removed ${removed} fact${removed !== 1 ? 's' : ''}.`;
    }
  });

  registry.register({
    name: '/search',
    aliases: ['/find'],
    description: 'Full-text search over current session messages.',
    usage: '/search <query>',
    handler: async (args, context) => {
      if (!args.length) return 'Usage: /search <query>';

      const sessionId = context.sessionManager.getCurrentSessionId();
      if (!sessionId) return 'No active session.';

      const query = args.join(' ');
      const results = await searchMessages(sessionId, query, { limit: 10 });

      if (!results.length) return `No messages matched "${query}".`;

      const lines = [`Search results for "${query}":\n`];
      for (const r of results) {
        const ts = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '';
        const preview = r.content.length > 120
          ? r.content.slice(0, 120) + '…'
          : r.content;
        lines.push(`[${r.role}${ts ? '  ' + ts : ''}]`);
        lines.push(`  ${preview}`);
        lines.push('');
      }
      return lines.join('\n').trimEnd();
    }
  });

  registry.register({
    name: '/pin',
    aliases: [],
    description: 'Pin the last assistant message so it stays in context.',
    usage: '/pin',
    handler: async (_args, context) => {
      const sessionId = context.sessionManager.getCurrentSessionId();
      if (!sessionId) return 'No active session.';

      const msg = await database.get(
        `SELECT id FROM messages
         WHERE session_id = ? AND role = 'assistant'
         ORDER BY timestamp DESC LIMIT 1`,
        [sessionId]
      );
      if (!msg) return 'No assistant message to pin.';

      await database.run(
        `UPDATE messages SET pinned = 1 WHERE id = ?`,
        [msg.id]
      );
      return 'Last assistant message pinned.';
    }
  });

  registry.register({
    name: '/unpin',
    aliases: [],
    description: 'Unpin the last pinned message.',
    usage: '/unpin',
    handler: async (_args, context) => {
      const sessionId = context.sessionManager.getCurrentSessionId();
      if (!sessionId) return 'No active session.';

      const msg = await database.get(
        `SELECT id FROM messages
         WHERE session_id = ? AND pinned = 1
         ORDER BY timestamp DESC LIMIT 1`,
        [sessionId]
      );
      if (!msg) return 'No pinned messages in this session.';

      await database.run(
        `UPDATE messages SET pinned = 0 WHERE id = ?`,
        [msg.id]
      );
      return 'Unpinned.';
    }
  });
}
