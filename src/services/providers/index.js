/**
 * Provider router.
 * Routes model names to the correct backend:
 *   claude-*              → Anthropic
 *   gpt-*, o1-*, o3-*    → OpenAI
 *   gemini-*              → Gemini
 *   nomi-*                → Nomi.ai
 *   kindroid-*            → Kindroid.ai
 *   @cf/*                 → Cloudflare Workers AI
 *   everything else       → Ollama (local)
 */
import * as ollamaProvider from './ollama.js';
import * as anthropicProvider from './anthropic.js';
import * as openaiProvider from './openai.js';
import * as geminiProvider from './gemini.js';
import * as nomiProvider from './nomi.js';
import * as kindroidProvider from './kindroid.js';
import * as cloudflareProvider from './cloudflare.js';
import { getKey } from '../keyStore.js';

const ENV_KEY = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  nomi: 'NOMI_API_KEY',
  kindroid: 'KINDROID_API_KEY',
};

function detectProvider(model) {
  if (!model) return 'ollama';
  const m = model.toLowerCase();
  if (m.startsWith('claude-')) return 'anthropic';
  if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3')) return 'openai';
  if (m.startsWith('gemini-')) return 'gemini';
  if (m.startsWith('nomi-')) return 'nomi';
  if (m.startsWith('kindroid-')) return 'kindroid';
  if (m.startsWith('@cf/')) return 'cloudflare';
  return 'ollama';
}

/**
 * Stream a chat turn through the appropriate provider.
 * Automatically retrieves the stored API key for cloud providers.
 *
 * @param {string} model
 * @param {Array} messages
 * @param {Object} options
 * @yields {{ message: { content: string } }}
 */
async function resolveKey(provider) {
  if (provider === 'cloudflare') {
    const stored = await getKey('cloudflare');
    if (stored) return stored;
    const accountId = process.env.CF_ACCOUNT_ID;
    const token = process.env.CF_API_TOKEN;
    if (accountId && token) return `${accountId}:${token}`;
    return null;
  }
  return (await getKey(provider)) || process.env[ENV_KEY[provider]] || null;
}

export async function* chat(model, messages, options = {}) {
  const provider = detectProvider(model);

  if (provider === 'anthropic') {
    const apiKey = await resolveKey('anthropic');
    if (!apiKey) throw new Error('No Anthropic API key found. Set ANTHROPIC_API_KEY in .env or use /key set anthropic <key>');
    yield* anthropicProvider.chat(model, messages, options, apiKey);
  } else if (provider === 'openai') {
    const apiKey = await resolveKey('openai');
    if (!apiKey) throw new Error('No OpenAI API key found. Set OPENAI_API_KEY in .env or use /key set openai <key>');
    yield* openaiProvider.chat(model, messages, options, apiKey);
  } else if (provider === 'gemini') {
    const apiKey = await resolveKey('gemini');
    if (!apiKey) throw new Error('No Gemini API key found. Set GEMINI_API_KEY in .env or use /key set gemini <key>');
    yield* geminiProvider.chat(model, messages, options, apiKey);
  } else if (provider === 'nomi') {
    const apiKey = await resolveKey('nomi');
    if (!apiKey) throw new Error('No Nomi.ai API key found. Set NOMI_API_KEY in .env or use /key set nomi <key>');
    yield* nomiProvider.chat(model, messages, options, apiKey);
  } else if (provider === 'kindroid') {
    const apiKey = await resolveKey('kindroid');
    if (!apiKey) throw new Error('No Kindroid.ai API key found. Set KINDROID_API_KEY in .env or use /key set kindroid <key>');
    yield* kindroidProvider.chat(model, messages, options, apiKey);
  } else if (provider === 'cloudflare') {
    const apiKey = await resolveKey('cloudflare');
    if (!apiKey) throw new Error('No Cloudflare credentials found. Set CF_ACCOUNT_ID + CF_API_TOKEN in .env or use /key set cloudflare <accountId>:<apiToken>');
    yield* cloudflareProvider.chat(model, messages, options, apiKey);
  } else {
    yield* ollamaProvider.chat(model, messages, options);
  }
}

/**
 * List models from all configured providers.
 * Always includes Ollama. Cloud providers only if keys are stored.
 */
export async function listAllModels() {
  const results = [];

  // Ollama — always included
  try {
    const ollamaModels = await ollamaProvider.listModels();
    results.push(...ollamaModels);
  } catch {
    // Ollama not running — skip
  }

  // Anthropic — if key is set (DB or env)
  const anthropicKey = await resolveKey('anthropic');
  if (anthropicKey) {
    try {
      const models = await anthropicProvider.listModels(anthropicKey);
      results.push(...models);
    } catch {
      // Key set but API unreachable — add fallback list
      results.push(
        { id: 'claude-opus-4-6', provider: 'anthropic' },
        { id: 'claude-sonnet-4-6', provider: 'anthropic' },
        { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' }
      );
    }
  }

  // OpenAI — if key is set (DB or env)
  const openaiKey = await resolveKey('openai');
  if (openaiKey) {
    try {
      const models = await openaiProvider.listModels(openaiKey);
      results.push(...models);
    } catch {
      results.push(
        { id: 'gpt-4o', provider: 'openai' },
        { id: 'gpt-4o-mini', provider: 'openai' }
      );
    }
  }

  // Gemini — if key is set (DB or env)
  const geminiKey = await resolveKey('gemini');
  if (geminiKey) {
    const models = await geminiProvider.listModels(geminiKey);
    results.push(...models);
  }

  // Nomi — if key is set (DB or env)
  const nomiKey = await resolveKey('nomi');
  if (nomiKey) {
    const models = await nomiProvider.listModels(nomiKey);
    results.push(...models);
  }

  // Kindroid — if key is set (DB or env)
  const kindroidKey = await resolveKey('kindroid');
  if (kindroidKey) {
    const models = await kindroidProvider.listModels(kindroidKey);
    results.push(...models);
  }

  // Cloudflare — if key is set (DB or env)
  const cloudflareKey = await resolveKey('cloudflare');
  if (cloudflareKey) {
    const models = await cloudflareProvider.listModels(cloudflareKey);
    results.push(...models);
  }

  return results;
}

export { detectProvider };
