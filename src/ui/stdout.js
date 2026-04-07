/**
 * Direct stdout printing — for permanent content that lives outside Ink's live region.
 * Ink manages the interactive bottom area; everything else is written here.
 */

const T = '\x1b[38;2;107;191;184m'; // teal
const W = '\x1b[37m';                // white
const D = '\x1b[2m';                 // dim
const B = '\x1b[1m';                 // bold
const R = '\x1b[0m';                 // reset

const WEAVE = [
  '   /\\/\\  ',
  '  / /  \\ ',
  ' / / /\\ \\',
  ' \\ \\/ / /',
  '  \\  / / ',
  '   \\/\\/  ',
];

const OREAD = [
  ' ██████╗ ██████╗ ███████╗ █████╗ ██████╗ ███████╗',
  '██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝',
  '██║   ██║██████╔╝█████╗  ███████║██║  ██║███████╗',
  '██║   ██║██╔══██╗██╔══╝  ██╔══██║██║  ██║╚════██║',
  '╚██████╔╝██║  ██║███████╗██║  ██║██████╔╝███████║',
  ' ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝',
];

const VERSION = '0.1.0';

export function printBanner() {
  const lines = WEAVE.map((w, i) => `${T}${B}${w}  ${OREAD[i]}${R}`);
  process.stdout.write('\n' + lines.join('\n') + '\n');
  process.stdout.write('\n');
  process.stdout.write(`${W}  Local-first LLM terminal  ·  Ollama · Anthropic · OpenAI · Gemini  ·  v${VERSION}${R}\n`);
  process.stdout.write(`${D}  /help for commands${R}\n\n`);
}

export function printMessage(role, content) {
  const dot = role === 'user' ? `${W}● ${R}` : `${T}● ${R}`;
  process.stdout.write(`\n${dot}${content}\n`);
}

export function printCommand(content) {
  process.stdout.write(`\n${D}${content}${R}\n`);
}

export function printClear() {
  process.stdout.write('\x1b[2J\x1b[H');
}
