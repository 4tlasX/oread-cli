/**
 * /summarize — manually trigger a Shape-First reasoning chain summary (beta).
 */
import { runChainSummary } from '../services/chainExtractor.js';
import { resolveShapefirstKey } from '../services/providers/shapefirst.js';

export function register(registry) {
  registry.register({
    name: '/summarize',
    aliases: [],
    description: 'Trigger a Shape-First reasoning chain summary (beta).',
    usage: '/summarize',
    handler: async (_args, context) => {
      const session = await context.sessionManager.getCurrentSession();
      if (!session) return 'No active session.';

      const settings = context.settingsManager.getAll();
      const enabled = settings?.general?.shapeFirstMemory === true;

      if (!enabled) {
        return [
          'Shape-First is not enabled.',
          '',
          'To enable:',
          '  /set general.shapeFirstMemory true',
          '',
          'Shape-First is a beta feature that uses Cloudflare Workers AI to build',
          'a reasoning chain from your conversation. Results may vary.',
          'Requires CF_ACCOUNT_ID and CF_API_TOKEN in your .env.',
        ].join('\n');
      }

      const credentials = await resolveShapefirstKey();
      if (!credentials) {
        return [
          'No Cloudflare credentials found.',
          '',
          'Shape-First uses CF_ACCOUNT_ID and CF_API_TOKEN from your .env.',
          'Set both and restart, or use a custom gateway:',
          '  /key set shapefirst <gatewayUrl>|<apiKey>|<model>',
        ].join('\n');
      }

      const model = settings?.general?.selectedModel || 'llama3.2';

      let chain;
      try {
        chain = await runChainSummary(session.id, model, settings, 'manual');
      } catch (err) {
        return `Shape-First error: ${err.message}`;
      }

      if (!chain) {
        return 'Could not generate a reasoning chain. The model may not have returned a usable response — try again or check your CF credentials.';
      }

      return `Reasoning chain saved:\n\n${chain}`;
    }
  });
}
