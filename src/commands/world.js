/**
 * World commands: /worlds, /world [id]
 */

export function register(registry) {
  registry.register({
    name: '/worlds',
    aliases: [],
    description: 'List all available worlds',
    usage: '/worlds',
    getDynamicArgs: async (context) => {
      const worlds = context.worldManager.listWorlds();
      return worlds.map(w => ({
        name: w.id,
        description: w.name + (w.isUserTemplate ? '  [user]' : ''),
        resolvedCommand: `/world ${w.id}`,
      }));
    },
    handler: async (_args, context) => {
      const worlds = context.worldManager.listWorlds();
      if (worlds.length === 0) return 'No worlds found.';
      const lines = worlds.map(w => `  ${w.id.padEnd(32)}${w.isUserTemplate ? '[user] ' : '       '}${w.name}`);
      return `Available worlds:\n\n${lines.join('\n')}`;
    }
  });

  registry.register({
    name: '/world',
    aliases: [],
    description: 'Show active world, load by id, switch character, or update a property.',
    usage: '/world [character <name> | update <key:value> | world-id]',
    subcommands: [
      { name: 'status',    description: 'Show current world name and character lineup' },
      { name: 'character', description: 'Switch the active character in this world' },
      { name: 'update',    description: 'Update a world property  key:value' },
    ],
    getDynamicArgs: async (context, subcommand) => {
      if (subcommand === 'character') {
        const characters = context.settingsManager.get('roleplay.characters') || [];
        const loaded = context.settingsManager.get('roleplay._loadedCharacters') || [];
        const activeNames = new Set(loaded.map(c => c.name));
        return characters
          .filter(c => c.name)
          .map(c => ({
            name: c.name,
            description: [c.role, c.age].filter(Boolean).join('  ·  ') + (activeNames.has(c.name) ? '  ◀' : ''),
          }));
      }
      // Default: world list
      const worlds = context.worldManager.listWorlds();
      return worlds.map(w => ({ name: w.id, description: w.name + (w.isUserTemplate ? '  [user]' : '') }));
    },
    handler: async (args, context) => {
      // /world status
      if (args[0] === 'status') {
        const s = context.settingsManager.getAll();
        const worldName = s?.name || s?.roleplay?.world?.name || 'none';
        const mode = s?.mode || 'normal';
        const charMode = s?.roleplay?.characterMode || 'single';
        const world = s?.roleplay?.world || {};
        const characters = s?.roleplay?.characters || [];
        const loaded = s?.roleplay?._loadedCharacters || [];
        const activeNames = new Set(loaded.map(c => c.name));
        const utility = s?.utility || {};
        const userPersona = s?.userPersona || {};
        const general = s?.general || {};

        const div = (label) => `\n  ─── ${label} ${'─'.repeat(Math.max(0, 34 - label.length))}`;
        const field = (label, value) => value ? `  ${label.padEnd(14)}${value}` : null;
        const block = (label, value) => {
          if (!value) return null;
          const wrapped = value.replace(/(.{1,74})(\s|$)/g, '  $1\n').trimEnd();
          return `  ${label}:\n${wrapped}`;
        };
        const list = (items) => items.map(it => `    •  ${it}`).join('\n');

        const lines = [
          `\n  ${worldName.toUpperCase()}`,
          `  ${'─'.repeat(worldName.length)}`,
          '',
          field('Mode', mode === 'roleplay' ? `roleplay  (${charMode})` : mode),
          field('Narrator', world.narratorVoice || null),
          field('Model', general.selectedModel || null),
        ].filter(Boolean);

        // Setting lore
        if (world.settingLore) {
          lines.push(div('Setting'));
          lines.push('');
          lines.push(block('', world.settingLore));
        }

        // Opening scene
        if (world.openingScene) {
          lines.push(div('Opening Scene'));
          lines.push('');
          lines.push(block('', world.openingScene));
        }

        // Hard rules
        if (world.hardRules?.length) {
          lines.push(div('Hard Rules'));
          lines.push('');
          lines.push(list(world.hardRules));
        }

        // Characters
        if (characters.length) {
          for (const c of characters) {
            const active = activeNames.has(c.name) ? '  ◀ active' : '';
            lines.push(div(`${c.name}${active}`));
            lines.push('');
            const meta = [c.age, c.gender, c.species].filter(Boolean).join('  ·  ');
            if (meta) lines.push(`  ${meta}`);
            if (c.role) lines.push(`  ${c.role}`);
            if (c.backstory)        { lines.push(''); lines.push(block('Backstory', c.backstory)); }
            if (c.knowledgeSkills)  { lines.push(''); lines.push(block('Knowledge', c.knowledgeSkills)); }
            if (c.hobbiesInterests) { lines.push(''); lines.push(block('Interests', c.hobbiesInterests)); }
            if (c.thingsToAvoid)    { lines.push(''); lines.push(block('Avoids', c.thingsToAvoid)); }
            if (c.inventory)        { lines.push(''); lines.push(block('Inventory', c.inventory)); }
            if (c.traits) {
              const traitList = Object.values(c.traits).flat().filter(Boolean);
              if (traitList.length) lines.push(`\n  Traits:        ${traitList.join('  ·  ')}`);
            }
          }
        }

        // Utility / assistant identity
        const persona = utility?.assistantIdentity?.persona;
        const commStyle = utility?.assistantIdentity?.communicationStyle;
        const guardrails = utility?.guardrails?.negativeConstraints;
        const formatting = utility?.guardrails?.formattingPreferences;
        if (persona || commStyle || guardrails || formatting) {
          lines.push(div('Assistant'));
          lines.push('');
          if (persona)    lines.push(block('Persona', persona));
          if (commStyle)  lines.push(block('Style', commStyle));
          if (guardrails) lines.push(block('Guardrails', guardrails));
          if (formatting) lines.push(block('Formatting', formatting));
        }

        // User persona
        const upName = userPersona.name;
        const upBio  = userPersona.bio;
        if (upName || upBio) {
          lines.push(div('User Persona'));
          lines.push('');
          if (upName) lines.push(field('Name', upName));
          if (userPersona.profession) lines.push(field('Profession', userPersona.profession));
          if (upBio)  lines.push(block('Bio', upBio));
        }

        lines.push('');
        return lines.filter(l => l !== null).join('\n');
      }

      // /world character <name>
      if (args[0] === 'character') {
        const name = args.slice(1).join(' ');
        if (!name) return 'Usage: /world character <name>';

        const characters = context.settingsManager.get('roleplay.characters') || [];
        const match =
          characters.find(c => c.name?.toLowerCase() === name.toLowerCase()) ||
          characters.find(c => c.name?.toLowerCase().includes(name.toLowerCase()));

        if (!match) {
          const available = characters.map(c => c.name).filter(Boolean).join(', ');
          return `Character "${name}" not found.\nAvailable: ${available || 'none defined in this world'}`;
        }

        context.settingsManager.set('roleplay._loadedCharacters', [match]);
        return `Active character: ${match.name}${match.role ? `  (${match.role})` : ''}`;
      }

      // /world update key:value
      if (args[0] === 'update') {
        const spec = args[1];
        if (!spec || !spec.includes(':')) return 'Usage: /world update <key:value>';

        const colonIdx = spec.indexOf(':');
        const keyPath = spec.slice(0, colonIdx);
        const rawValue = spec.slice(colonIdx + 1);
        if (!keyPath) return 'Usage: /world update <key:value>';

        let value;
        if (rawValue === 'true') value = true;
        else if (rawValue === 'false') value = false;
        else if (rawValue === 'null') value = null;
        else if (!isNaN(Number(rawValue)) && rawValue !== '') value = Number(rawValue);
        else value = rawValue;

        context.settingsManager.set(keyPath, value);
        return `Updated ${keyPath} = ${JSON.stringify(value)}`;
      }

      // No args — show current world
      if (!args.length) {
        const settings = context.settingsManager.getAll();
        const session = await context.sessionManager.getCurrentSession();
        const worldName = settings?.name || settings?.roleplay?.world?.name || 'none';
        const loaded = settings?.roleplay?._loadedCharacters || [];
        const charLine = loaded.length ? `  Character: ${loaded.map(c => c.name).join(', ')}` : '';
        const sessionLine = session ? `  Session: ${session.name} (${session.id.slice(0, 8)}...)` : '  Session: none';
        return [`Active world: ${worldName}`, charLine, sessionLine].filter(Boolean).join('\n');
      }

      // /world <id> — load world
      const id = args[0];
      const worldData = context.worldManager.loadWorld(id);
      if (!worldData) return `World not found: "${id}"\nUse /worlds to see available worlds.`;

      const current = context.settingsManager.getAll();
      const newSettings = {
        ...current,
        ...(worldData.settings || {}),
        general: { ...current.general, ...(worldData.settings?.general || {}) },
        name: worldData.name || id,
        meta: { ...(worldData.settings?.meta || {}), templateId: id },
      };
      context.settingsManager.setAll(newSettings);

      const sessions = await context.sessionManager.listSessions();
      const recent = sessions.slice(0, 5);
      const session = await context.sessionManager.createSession(worldData.name || id, newSettings);

      const lines = [
        `World loaded: ${worldData.name || id}`,
        `New session started: ${session.name} (${session.id.slice(0, 8)}...)`,
        '',
      ];
      if (recent.length) {
        lines.push('Or switch to an existing session:');
        for (const s of recent) lines.push(`  /session ${s.id.slice(0, 8)}   ${s.name} (${s.message_count} msgs)`);
      }
      return lines.join('\n');
    }
  });

  registry.register({
    name: '/mode',
    aliases: [],
    description: 'Switch between assistant, single-character, or multi-character mode.',
    usage: '/mode <assistant|single|multi>',
    getDynamicArgs: async (context) => {
      const mode = context.settingsManager.get('mode');
      const charMode = context.settingsManager.get('roleplay.characterMode');
      const active = (m) => m ? '  ◀' : '';
      return [
        { name: 'assistant', description: 'Normal assistant mode'           + active(mode === 'normal') },
        { name: 'single',    description: 'Roleplay — single character'     + active(mode === 'roleplay' && charMode === 'single') },
        { name: 'multi',     description: 'Roleplay — multiple characters'  + active(mode === 'roleplay' && charMode === 'multi') },
      ];
    },
    handler: async (args, context) => {
      const m = args[0];
      if (!m) return 'Usage: /mode <assistant|single|multi>';

      if (m === 'assistant') {
        context.settingsManager.set('mode', 'normal');
        return 'Mode: assistant';
      }
      if (m === 'single') {
        context.settingsManager.set('mode', 'roleplay');
        context.settingsManager.set('roleplay.characterMode', 'single');
        return 'Mode: roleplay  (single character)';
      }
      if (m === 'multi') {
        context.settingsManager.set('mode', 'roleplay');
        context.settingsManager.set('roleplay.characterMode', 'multi');
        return 'Mode: roleplay  (multi-character)';
      }
      return `Unknown mode "${m}". Options: assistant, single, multi`;
    }
  });
}
