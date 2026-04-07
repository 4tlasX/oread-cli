/**
 * Export command: /export — dumps current session as markdown
 */
import fs from 'fs';
import path from 'path';
import database from '../services/database.js';

const ROOT = process.env.OREAD_ROOT || path.resolve('.');

export function register(registry) {
  registry.register({
    name: '/export',
    aliases: [],
    description: 'Export current session as a markdown file.',
    usage: '/export [filename]',
    handler: async (args, context) => {
      const session = await context.sessionManager.getCurrentSession();
      if (!session) return 'No active session.';

      const messages = await context.sessionManager.getMessages(session.id);
      const facts = session.extracted_facts ? JSON.parse(session.extracted_facts) : [];
      const worldState = session.world_state ? JSON.parse(session.world_state) : null;

      const lines = [];

      // Header
      lines.push(`# ${session.name}`);
      lines.push(`*Session ID: ${session.id}*`);
      lines.push(`*Mode: ${session.mode}*`);
      lines.push(`*Exported: ${new Date().toLocaleString()}*`);
      lines.push('');

      // Summary
      if (session.rolling_summary) {
        lines.push('## Summary');
        lines.push(session.rolling_summary);
        lines.push('');
      }

      // Notes
      if (session.story_notes) {
        lines.push('## Notes');
        lines.push(session.story_notes);
        lines.push('');
      }

      // Facts
      if (facts.length) {
        lines.push('## Extracted Facts');
        for (const f of facts) {
          const cat = (f.type || f.category) ? `**[${f.type || f.category}]** ` : '';
          const text = f.text || f.content || (typeof f === 'string' ? f : JSON.stringify(f));
          lines.push(`- ${cat}${text}`);
        }
        lines.push('');
      }

      // World state
      if (worldState) {
        lines.push('## World State');
        lines.push('```json');
        lines.push(JSON.stringify(worldState, null, 2));
        lines.push('```');
        lines.push('');
      }

      // Messages
      lines.push('## Conversation');
      lines.push('');
      for (const msg of messages) {
        const roleLabel = msg.role === 'user' ? '**You**' : '**Assistant**';
        const pin = msg.pinned ? ' 📌' : '';
        lines.push(`${roleLabel}${pin}`);
        lines.push('');
        lines.push(msg.content);
        lines.push('');
        lines.push('---');
        lines.push('');
      }

      const markdown = lines.join('\n');

      // Write to file
      const exportsDir = path.join(ROOT, 'data', 'exports');
      fs.mkdirSync(exportsDir, { recursive: true });

      const rawName = args[0] ? path.basename(args[0]) : null;
      const filename = rawName
        ? (rawName.endsWith('.md') ? rawName : rawName + '.md')
        : `${session.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.md`;

      const filepath = path.join(exportsDir, filename);
      fs.writeFileSync(filepath, markdown, 'utf-8');

      return `Exported to ${path.relative(ROOT, filepath)}`;
    }
  });
}
