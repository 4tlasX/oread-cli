/**
 * API key management commands: /key set, /key list, /key remove
 */
import { setKey, removeKey, listConfiguredProviders } from '../services/keyStore.js';

const SUPPORTED_PROVIDERS = ['anthropic', 'openai', 'gemini', 'groq', 'nomi', 'kindroid'];

export function register(registry) {
  registry.register({
    name: '/key',
    aliases: [],
    description: 'Manage API keys for cloud providers.',
    usage: '/key set <provider> <key> | /key list | /key remove <provider>',
    subcommands: [
      { name: 'set',    description: 'Save an API key for a provider' },
      { name: 'list',   description: 'List configured providers' },
      { name: 'remove', description: 'Remove a saved key' },
    ],
    handler: async (args, _context) => {
      const subcommand = args[0];

      if (!subcommand || subcommand === 'list') {
        const providers = await listConfiguredProviders();
        if (!providers.length) {
        return [
          'No API keys configured.',
          '',
          'To add a key:',
          '  /key set anthropic sk-ant-...',
          '  /key set openai sk-...',
          '  /key set gemini ...',
          '  /key set nomi <uuid-api-key>',
          '  /key set kindroid <kn_...-api-key>',
        ].join('\n');
        }
        const lines = ['Configured providers:\n'];
        for (const p of providers) {
          const updated = p.updated_at ? `  (saved ${new Date(p.updated_at).toLocaleDateString()})` : '';
          lines.push(`  ${p.provider}${updated}`);
        }
        lines.push('');
        lines.push('Keys are stored encrypted. Use /key remove <provider> to delete.');
        return lines.join('\n');
      }

      if (subcommand === 'set') {
        const provider = args[1]?.toLowerCase();
        const key = args[2];

        if (!provider) return 'Usage: /key set <provider> <key>';
        if (!key) return `Usage: /key set ${provider} <key>`;
        if (!SUPPORTED_PROVIDERS.includes(provider)) {
          return `Unsupported provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`;
        }

        await setKey(provider, key);
        return `API key for ${provider} saved (encrypted).`;
      }

      if (subcommand === 'remove') {
        const provider = args[1]?.toLowerCase();
        if (!provider) return 'Usage: /key remove <provider>';

        await removeKey(provider);
        return `API key for ${provider} removed.`;
      }

      return `Unknown subcommand "${subcommand}". Usage: /key set | /key list | /key remove`;
    }
  });
}
