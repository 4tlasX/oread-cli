/**
 * CommandRegistry — stores and dispatches slash commands.
 */
export class CommandRegistry {
  constructor() {
    /** @type {Map<string, import('./types.js').CommandDefinition>} */
    this._commands = new Map();
  }

  /**
   * Register a command definition.
   * @param {{ name: string, aliases?: string[], description: string, usage: string, handler: Function }} def
   */
  register(def) {
    this._commands.set(def.name, def);
    if (def.aliases) {
      for (const alias of def.aliases) {
        this._commands.set(alias, def);
      }
    }
  }

  /**
   * Execute a slash command input string.
   * @param {string} input - Full slash command line, e.g. "/load fantasy-tavern"
   * @param {Object} context - Engine context
   * @returns {Promise<{ output: string }>}
   */
  async execute(input, context) {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return { output: 'Not a command.' };
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const cmdName = '/' + parts[0];
    const args = parts.slice(1);

    const def = this._commands.get(cmdName);
    if (!def) {
      return { output: `Unknown command: ${cmdName}. Type /help for available commands.` };
    }

    try {
      const result = await def.handler(args, context);
      if (typeof result === 'string') return { output: result };
      return { output: result?.output ?? '', action: result?.action, content: result?.content };
    } catch (err) {
      return { output: `Error: ${err.message}` };
    }
  }

  /**
   * Return all unique command definitions (no alias duplicates), sorted by name.
   * @returns {Array<{ name: string, description: string, usage: string }>}
   */
  getCommands() {
    const seen = new Set();
    const commands = [];
    for (const def of this._commands.values()) {
      if (seen.has(def.name)) continue;
      seen.add(def.name);
      commands.push({
        name: def.name,
        description: def.description,
        usage: def.usage,
        subcommands: def.subcommands || [],
        getDynamicArgs: def.getDynamicArgs || null,
      });
    }
    return commands.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get formatted help text for all unique commands.
   * @returns {string}
   */
  getHelp() {
    const seen = new Set();
    const defs = [];

    for (const def of this._commands.values()) {
      if (seen.has(def.name)) continue;
      seen.add(def.name);
      defs.push(def);
    }
    defs.sort((a, b) => a.name.localeCompare(b.name));

    // Build left column strings first so we can measure max width
    const rows = defs.map(def => {
      const aliases = def.aliases && def.aliases.length > 0
        ? ` (${def.aliases.join(', ')})`
        : '';
      return { left: `${def.name}${aliases}`, description: def.description, usage: def.usage };
    });

    const colWidth = Math.max(...rows.map(r => r.left.length));
    const indent = ' '.repeat(colWidth + 4); // 2 leading spaces + gap
    const lines = ['Available commands:\n'];

    for (const { left, description, usage } of rows) {
      const descLines = description ? description.split('\n') : [];
      const firstDesc = descLines[0] || '';
      lines.push(`  ${left.padEnd(colWidth)}  ${firstDesc}`);
      for (const dl of descLines.slice(1)) {
        lines.push(`${indent}${dl}`);
      }
      if (usage) lines.push(`${indent}Usage: ${usage}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}
