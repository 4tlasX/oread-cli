#!/usr/bin/env node
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// When bundled, import.meta.url resolves to dist/oread.js — one level up is the project root.
// When run directly from bin/, two levels up is the project root.
// We detect which by checking if this file is inside a 'dist' directory.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname.endsWith('dist')
  ? path.resolve(__dirname, '..')
  : path.resolve(__dirname, '..');

// Set early so all services can use it regardless of how import.meta.url resolves
process.env.OREAD_ROOT = projectRoot;

// Load .env from project root
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: envPath });
}

// Parse flags
const args = process.argv.slice(2);
const withApi = args.includes('--api');
const noRepl = args.includes('--no-repl');
const portArg = args.find(a => a.startsWith('--port='));
const port = portArg ? parseInt(portArg.split('=')[1]) : (parseInt(process.env.API_PORT) || 3002);

import { initialize } from '../src/core/engine.js';

try {
  await initialize();
} catch (err) {
  console.error('Failed to initialize oread:', err.message);
  process.exit(1);
}

// Start API server if requested
if (withApi) {
  const { startServer } = await import('../src/api/server.js');
  await startServer(port);
}

// Start terminal UI unless --no-repl
if (!noRepl) {
  const { printBanner } = await import('../src/ui/stdout.js');
  printBanner();
  const { render } = await import('ink');
  const React = (await import('react')).default;
  const { default: App } = await import('../src/ui/App.jsx');
  render(React.createElement(App));
} else if (!withApi) {
  console.log('No mode selected. Use --api to start the API server, or run without --no-repl for the terminal UI.');
  process.exit(0);
}
