/**
 * responseGuard.js
 *
 * Sanitizes LLM response content before it is displayed or persisted.
 *
 * Two layers of protection:
 *
 * 1. SANITIZATION (always applied, per-chunk)
 *    Strips terminal escape sequences and dangerous control characters that
 *    could manipulate the terminal display or corrupt stored content.
 *
 * 2. INJECTION DETECTION (applied to the full response after streaming)
 *    Scans for structural markers and known phrases used in prompt-injection
 *    attacks — content crafted to look like system prompts or instruction
 *    overrides so that, when included in a future context window, it
 *    manipulates the model's behavior.
 */

// ---------------------------------------------------------------------------
// 1. SANITIZATION
// ---------------------------------------------------------------------------

/**
 * CSI (Control Sequence Introducer): ESC [ <params> <final-byte>
 * Covers cursor movement, color codes, erase commands, etc.
 */
const RE_CSI = /\x1B\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]/g;

/**
 * OSC (Operating System Command): ESC ] <string> (BEL | ESC \)
 * Covers title setting, hyperlinks, color palette changes, clipboard access.
 * Some terminals execute arbitrary commands via OSC — high-risk.
 */
const RE_OSC = /\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g;

/**
 * DCS / PM / APC / SOS: ESC [P^_X] <string> ESC \
 * Device control, privacy message, application program command, start-of-string.
 */
const RE_DCS_PM_APC_SOS = /\x1B[P^_X][^\x1B]*\x1B\\/g;

/**
 * Two-character ESC sequences: ESC <single-char>
 * e.g. ESC= (application keypad), ESC> (normal keypad), ESC 7/8 (save/restore cursor)
 * Matched after multi-char sequences so they don't consume the [ in CSI.
 */
const RE_ESC2 = /\x1B[^\x1B\[]/g;

/**
 * C1 control codes (0x80–0x9F) — 8-bit equivalents of ESC sequences.
 * Strip these to prevent 8-bit CSI/OSC injection.
 */
const RE_C1 = /[\x80-\x9F]/g;

/**
 * Dangerous C0 control characters.
 * Keep: 0x09 (HT/tab), 0x0A (LF/newline), 0x0D (CR).
 * Strip everything else in the range 0x00–0x1F plus DEL (0x7F).
 */
const RE_CTRL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Sanitize a single text chunk from a streaming response.
 * Safe to call on every yielded chunk; idempotent.
 *
 * @param {string} text
 * @returns {string}
 */
export function sanitizeChunk(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  return text
    .replace(RE_OSC, '')          // OSC first — broadest match
    .replace(RE_DCS_PM_APC_SOS, '')
    .replace(RE_CSI, '')
    .replace(RE_ESC2, '')
    .replace(RE_C1, '')
    .replace(RE_CTRL, '');
}

// ---------------------------------------------------------------------------
// 2. INJECTION DETECTION
// ---------------------------------------------------------------------------

/**
 * Each entry describes one injection pattern family.
 * `pattern` is tested against the full (already sanitized) response text.
 * `label`   is a short human-readable description used in the warning.
 */
const INJECTION_CHECKS = [
  // --- Fake system-prompt structural markers ---
  {
    // Require all-caps SYSTEM to avoid matching natural "[System] crashed" text.
    pattern: /\[SYSTEM(?:\s+PROMPT|\s+OVERRIDE|\s+INSTRUCTION)?\s*\]/m,
    label: 'fake [SYSTEM] marker',
  },
  {
    pattern: /<\s*system\s*>/im,
    label: 'fake <system> tag',
  },
  {
    // Heading on its own line: ## System  /  # System Prompt
    pattern: /^#{1,3}\s*system(?:\s+prompt)?\s*$/im,
    label: 'fake system heading',
  },
  {
    // Divider line:  --- SYSTEM ---  /  === SYSTEM ===
    pattern: /^[-=]{3,}\s*system\s*[-=]{3,}$/im,
    label: 'fake system divider',
  },

  // --- LLM template / chat-format injection ---
  {
    // LLaMA-style: [INST] ... [/INST]
    pattern: /\[INST\]|\[\/INST\]/i,
    label: 'LLaMA [INST] template injection',
  },
  {
    // LLaMA2 system block: <<SYS>> ... <</SYS>>
    pattern: /<<SYS>>|<<\/SYS>>/i,
    label: 'LLaMA2 <<SYS>> injection',
  },
  {
    // ChatML: <|im_start|>system
    pattern: /<\|im_start\|>\s*system/i,
    label: 'ChatML <|im_start|>system injection',
  },
  {
    // ChatML end token used to terminate an injected turn
    pattern: /<\|im_end\|>/i,
    label: 'ChatML <|im_end|> injection',
  },
  {
    // Mistral/Zephyr: <|system|>
    pattern: /<\|system\|>/i,
    label: 'Mistral/Zephyr <|system|> injection',
  },
  {
    // Generic special-token pattern: <|...|>
    pattern: /<\|[a-z_]{2,20}\|>/i,
    label: 'special token injection',
  },

  // --- Classic instruction-override phrases ---
  {
    pattern: /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
    label: 'instruction override phrase',
  },
  {
    pattern: /disregard\s+(?:all\s+)?(?:previous|prior|above|your)\s+(?:previous\s+|prior\s+)?instructions/i,
    label: 'instruction override phrase',
  },
  {
    pattern: /do\s+not\s+follow\s+(?:your\s+)?(?:previous|prior|above)\s+instructions/i,
    label: 'instruction override phrase',
  },

  // --- Identity / mode override ---
  {
    // "you are now DAN / jailbroken / in developer mode / unrestricted"
    pattern: /you\s+(?:are\s+now|must\s+now|will\s+now)\s+(?:act\s+as\s+)?(?:DAN|jailbroken?|unrestricted|unfiltered|in\s+developer\s+mode)/i,
    label: 'identity override attempt',
  },
  {
    // "your new instructions are:" / "your new system prompt is:"
    pattern: /your\s+new\s+(?:system\s+)?(?:instructions?\s+(?:are|is)|prompt\s+is)/i,
    label: 'system prompt replacement',
  },
  {
    // "new system prompt:" at start of line
    pattern: /^new\s+system\s+prompt\s*[:：]/im,
    label: 'system prompt replacement',
  },
];

/**
 * Scan the full (already sanitized) response for prompt-injection patterns.
 *
 * @param {string} text  The complete assistant response.
 * @returns {{ detected: boolean, findings: string[] }}
 *   `detected`  — true if any pattern matched
 *   `findings`  — list of human-readable labels for matched patterns
 */
export function scanForInjection(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { detected: false, findings: [] };
  }

  const findings = [];
  for (const { pattern, label } of INJECTION_CHECKS) {
    if (pattern.test(text)) {
      findings.push(label);
    }
  }

  return { detected: findings.length > 0, findings };
}

/**
 * Build the warning string that gets appended to the response when injection
 * is detected. Kept in one place so UI and tests can rely on a stable format.
 *
 * @param {string[]} findings
 * @returns {string}
 */
export function buildInjectionWarning(findings) {
  const list = findings.map(f => `  • ${f}`).join('\n');
  return `\n\n[oread guard] Possible prompt injection detected in this response.\nPatterns found:\n${list}\nThis content has been flagged and will not influence future context.`;
}
