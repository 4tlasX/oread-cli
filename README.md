# oread-cli

Local-first LLM interface with a Claude Code-style terminal UI. Chat with Ollama models or cloud providers (Anthropic, OpenAI) through a persistent, memory-aware session engine.

All memory is stored locally in SQLite. Cloud providers are opt-in. Nothing leaves your machine by default.

### About
CLI emerged from this original project: https://github.com/4tlasX/oread-companion

The goal is to eventually make this the backend for the original GUI which will turn into a desktop app. 

<img width="1111" height="593" alt="Screenshot 2026-04-06 at 10 37 07 PM" src="https://github.com/user-attachments/assets/b77dd237-67e8-4b52-a136-e91553ad33c6" />
<img width="1105" height="591" alt="Screenshot 2026-04-06 at 10 37 24 PM" src="https://github.com/user-attachments/assets/dd650c0e-1592-4983-8fe7-0d21480f8a7c" />

## Quick start

```bash
OLLAMA_MAX_LOADED_MODELS=2 ollama serve   # in a separate terminal

npm install
npm run build
npm link

oread
```

## Running modes

```bash
oread                        # Terminal UI (default)
oread --api                  # Terminal UI + API server on :3002
oread --api --no-repl        # API server only (headless)
oread --api --port=4000      # Custom port
```

## Slash commands

### Worlds & Sessions
| Command | Description |
|---|---|
| `/worlds` | Interactive world picker |
| `/world <id>` | Load a world, start a new session, show recent sessions to resume |
| `/world` | Show active world and current session |
| `/sessions` | Interactive session picker |
| `/session <id-or-name>` | Switch to a session by ID prefix or name |
| `/session` | Show current session detail |
| `/new [name]` | Create a new session with current world settings |

### Models
| Command | Description |
|---|---|
| `/model` | Interactive model picker (lists all providers) |
| `/model <name>` | Switch to a specific model directly |
| `/models` | Alias for `/model` |
| `/pull <name>` | Pull a model from Ollama or HuggingFace |

### Memory
| Command | Description |
|---|---|
| `/memory` | Show session facts, summary, world state, stances |
| `/memory global` | Show cross-session global memory |
| `/forget <text>` | Remove matching facts from session |
| `/search <query>` | Full-text search over session messages |
| `/pin` | Pin the last assistant message (keeps it in context) |
| `/unpin` | Unpin the last pinned message |

### Notes & Settings
| Command | Description |
|---|---|
| `/notes` | View session notes |
| `/notes set <text>` | Write session notes |
| `/notes clear` | Clear session notes |
| `/settings` | Show key settings |
| `/settings <key.path>` | Inspect a specific setting |
| `/set <key.path> <value>` | Change a setting (e.g. `/set general.temperature 0.9`) |

### API Keys
| Command | Description |
|---|---|
| `/key set anthropic <key>` | Store Anthropic API key (encrypted) |
| `/key set openai <key>` | Store OpenAI API key (encrypted) |
| `/key set gemini <key>` | Store Gemini API key (encrypted) |
| `/key set nomi <key>` | Store Nomi.ai API key (encrypted) |
| `/key set kindroid <key>` | Store Kindroid.ai API key (encrypted) |
| `/key list` | Show configured providers |
| `/key remove <provider>` | Delete a key |

Keys can also be set via `.env` — see [Environment](#environment) below. The encrypted DB key takes priority over the env var if both are present.

### Utilities
| Command | Description |
|---|---|
| `/status` | Show full status — world, session, model, memory stats |
| `/export` | Export session as markdown to `data/exports/` |
| `/export <filename>` | Export with a specific filename |
| `/help` | List all commands |
| `/exit` | Exit |

## UI layout

```
  you   › Hello
  elara › I'm Elara, keeper of the Rusty Flagon...

──────────────────────────────────────────────────
 › your message here
──────────────────────────────────────────────────
[oread]  Fantasy Tavern  •  llama3.2  •  session
```

Role labels align to a fixed column. Status bar sits below the input — world, model, session update live after every command.

## Model routing

Model names are routed automatically by prefix:

```
claude-*          → Anthropic   (ANTHROPIC_API_KEY or /key set anthropic)
gpt-*, o1-*, o3-* → OpenAI      (OPENAI_API_KEY or /key set openai)
gemini-*          → Gemini      (GEMINI_API_KEY or /key set gemini)
nomi-*            → Nomi.ai     (NOMI_API_KEY or /key set nomi)
kindroid-*        → Kindroid.ai (KINDROID_API_KEY or /key set kindroid)
anything else     → Ollama      (local, no key needed)
```

Switch mid-conversation with `/model <name>` — world, memory, and session stay the same.

## Pulling models

`/pull` accepts Ollama model names, HuggingFace repo paths, and full HuggingFace resolve URLs:

```bash
/pull llama3.2
/pull hf.co/bartowski/Llama-3.2-3B-Instruct-GGUF
/pull https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf
```

A progress bar replaces the input while downloading. ESC cancels. On completion the model is automatically set as active.

## Worlds

Worlds are JSON files that configure persona, memory behavior, model settings, and user preferences. 22 built-in worlds are included.

```
data/templates/
  defaults/       # 22 built-in worlds (read-only)
  user/           # Your saved worlds
  active.json     # Currently active settings
```

Drop any compatible JSON file into `data/templates/user/` to add a world.
Set `CHAT_TEMPLATES_DIR=/path/to/other/defaults` to load worlds from another directory.

## API

When running with `--api`, the server exposes:

```
GET  /api/health
GET  /api/models
POST /api/models/pull              SSE download progress
POST /api/chat                     SSE streaming  { message, sessionId? }
GET/POST          /api/sessions
GET/PUT/DELETE    /api/sessions/:id
GET               /api/sessions/:id/messages
GET/PUT           /api/sessions/:id/notes
GET               /api/sessions/:id/world-state
GET               /api/sessions/:id/search?q=
GET/PUT/DELETE    /api/templates
GET/PUT/DELETE    /api/templates/active
POST              /api/templates/user
GET/PUT/DELETE    /api/memory/global
GET               /api/memory/search?q=
GET               /api/memory/relationships
```

## Security

- API keys encrypted with AES-256-GCM; secret auto-generated at `data/.secret` (chmod 600)
- Set `OREAD_SECRET` env var to use your own passphrase
- API server binds to `127.0.0.1` only — not reachable from the network without a reverse proxy
- Export filenames are sanitized to prevent path traversal
- LLM responses are sanitized via `responseGuard`: strips ANSI/terminal escape sequences and flags prompt-injection patterns before display or persistence
- FTS5 queries are hardened against injection; UUID validation on all session API routes
- `settings_snapshot` is stripped from all API responses
- No telemetry; no outbound connections except Ollama (local) and configured cloud providers

## Environment

```bash
OLLAMA_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3.2
OLLAMA_EXTRACTION_MODEL=phi4-mini
OLLAMA_MAX_LOADED_MODELS=2      # Keep chat + extraction models warm simultaneously
CHAT_TEMPLATES_DIR=             # Optional: load worlds from another directory
API_PORT=3002
OREAD_SECRET=                   # Optional: custom encryption passphrase

# Cloud provider API keys (alternative to /key set <provider> <key>)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
NOMI_API_KEY=
KINDROID_API_KEY=

# Character/model IDs for companion providers
NOMI_MODEL=                     # Nomi companion UUID
KINDROID_MODEL=                 # Kindroid AI ID
```

Copy `.env.example` to `.env` to configure.

## Development

```bash
npm run build     # Compile JSX + bundle to dist/oread.js
npm run watch     # Rebuild on file changes
npm run dev       # Build + run
```

After any source change: `npm run build` then `oread`.
