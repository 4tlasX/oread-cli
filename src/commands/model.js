/**
 * Model commands: /model, /models, /use
 */
import { listAllModels } from '../services/providers/index.js';

export function register(registry) {
  registry.register({
    name: '/model',
    aliases: [],
    description: 'Show or set the active model. /model <name> to switch.',
    usage: '/model [name]',
    handler: async (args, context) => {
      if (args.length) {
        const model = args[0];
        context.settingsManager.set('general.selectedModel', model);
        return `Model set to: ${model}`;
      }
      const model = context.settingsManager.get('general.selectedModel') || process.env.OLLAMA_CHAT_MODEL || 'llama3.2';
      return `Current model: ${model}`;
    }
  });

  registry.register({
    name: '/models',
    aliases: [],
    description: 'List available models from all configured providers.',
    usage: '/models',
    handler: async (_args, _context) => {
      try {
        const models = await listAllModels();
        if (!models.length) return 'No models found. Make sure Ollama is running.';

        // Group by provider
        const byProvider = {};
        for (const m of models) {
          const p = m.provider || 'ollama';
          if (!byProvider[p]) byProvider[p] = [];
          byProvider[p].push(m);
        }

        const lines = [];
        for (const [provider, list] of Object.entries(byProvider)) {
          lines.push(`\n${provider.toUpperCase()}:`);
          for (const m of list) {
            const size = m.size ? `  (${(m.size / 1e9).toFixed(1)}GB)` : '';
            lines.push(`  ${m.id || m.name}${size}`);
          }
        }
        return `Available models:${lines.join('\n')}`;
      } catch (err) {
        return `Failed to list models: ${err.message}`;
      }
    }
  });
}
