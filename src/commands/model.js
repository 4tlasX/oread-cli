/**
 * Model commands: /model, /models, /pull
 */
import { listAllModels } from '../services/providers/index.js';
import { updateUserWorldField } from '../world/worldManager.js';

function getDefaultModel(settings) {
  if (settings?.general?.selectedModel) return settings.general.selectedModel;
  const kindroidId = process.env.KINDROID_MODEL;
  if (kindroidId) return `kindroid-${kindroidId}`;
  const nomiId = process.env.NOMI_MODEL;
  if (nomiId) return `nomi-${nomiId}`;
  return process.env.OLLAMA_CHAT_MODEL || 'llama3.2';
}

function normalizeModelName(input) {
  let name = input.trim();
  // HuggingFace resolve URL: .../resolve/main/model.gguf → hf.co/user/repo:model
  const resolveMatch = name.match(
    /(?:https?:\/\/)?(?:huggingface\.co|hf\.co)\/([^/]+)\/([^/]+)\/resolve\/[^/]+\/([^/?#]+\.gguf)/i
  );
  if (resolveMatch) {
    const [, user, repo, filename] = resolveMatch;
    return `hf.co/${user}/${repo}:${filename.replace(/\.gguf$/i, '')}`;
  }
  // huggingface.co/... or https://huggingface.co/... → hf.co/...
  return name.replace(/^https?:\/\//, '').replace(/^huggingface\.co\//, 'hf.co/');
}

export function register(registry) {
  registry.register({
    name: '/model',
    aliases: [],
    description: 'Show or set the active model. /model <name> to switch.',
    usage: '/model [name]',
    handler: async (args, context) => {
      const settings = context.settingsManager?.getAll() || {};
      const defaultModel = getDefaultModel(settings);
      if (args.length) {
        const model = args[0];
        context.settingsManager.set('general.selectedModel', model);
        const templateId = context.settingsManager.get('meta.templateId');
        if (templateId) updateUserWorldField(templateId, 'general.selectedModel', model);
        return `Model set to: ${model}`;
      }
      try {
        const models = await listAllModels();
        if (!models.length) {
          return `Current model: ${defaultModel}`;
        }
        const active = context.settingsManager.get('general.selectedModel') || defaultModel;
        return {
          action: 'select',
          content: {
            label: `Select model  (active: ${active})`,
            items: models.map(m => ({ label: m.id || m.name, value: m.id || m.name })),
            resolveCommand: (value) => `/model ${value}`,
          },
        };
      } catch {
        return `Current model: ${defaultModel}`;
      }
    }
  });

  registry.register({
    name: '/pull',
    aliases: [],
    description: 'Pull a model from Ollama or HuggingFace. Accepts model names, hf.co/... paths, or full HuggingFace URLs.',
    usage: '/pull <model-name-or-hf-url>',
    handler: async (args, _context) => {
      if (!args.length) return 'Usage: /pull <model-name-or-hf-url>';
      const modelName = normalizeModelName(args.join(' '));
      return {
        action: 'pull',
        content: { modelName },
      };
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
