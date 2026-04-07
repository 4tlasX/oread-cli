# Oread CLI — Implementation Plan

## Context

The existing `chat/` app is a full-stack Node/React LLM interface built on Ollama. It has a rich world/template system (22 built-in worlds as JSON files), SQLite memory, and post-chat extraction pipelines (facts, summaries, world state, stance, debate). The GUI is tightly coupled to the Express backend.

The goal: build `oread-cli` as a **standalone, complete entity** — a terminal UI with slash commands that runs Ollama (and optional cloud models), uses the same world JSON schema, and is architected to eventually replace the chat app's Express backend. The chat GUI becomes a skin on top of it.

---

## UI Style

Claude Code-style terminal interface using **Ink** (React for terminals):
- Chat history scrolls above
- Bordered input box pinned at the bottom
- Streaming responses render in real time via state updates

```
╭──────────────────────────────────────────────────────────╮
│ > your message here_                                     │
╰──────────────────────────────────────────────────────────╯
```

---

## Architecture

Three runtime modes from a single codebase:
- **Standalone CLI** — Ink terminal UI, no HTTP
- **API server** — same core engine, Express on top (`--api` flag)
- **Both** — terminal UI + API running simultaneously (eventual production mode)

The **core engine** (`src/core/`) has zero HTTP and zero Ink imports. Both interface layers call the same core functions.

---

## Folder Structure

```
oread-cli/
├── bin/
│   └── oread.js                  # Entry point: shebang, argv, mode dispatch
├── src/
│   ├── core/
│   │   ├── engine.js             # Initialize all services → exports context singleton
│   │   ├── chatPipeline.js       # One turn: build prompt → LLM stream → post-process
│   │   └── promptBuilder.js      # Port of chat/client/src/utils/promptBuilder.js
│   ├── services/                 # Copied/adapted from chat/services/
│   │   ├── database.js           # Same schema, path changed to data/oread.db
│   │   ├── providers/
│   │   │   ├── index.js          # Routes by model name prefix → correct adapter
│   │   │   ├── ollama.js         # Ollama npm package wrapper
│   │   │   ├── anthropic.js      # @anthropic-ai/sdk wrapper
│   │   │   └── openai.js         # openai npm package wrapper
│   │   ├── contextWindow.js      # COPY verbatim
│   │   ├── factExtractor.js      # COPY verbatim
│   │   ├── summarizer.js         # COPY verbatim
│   │   ├── worldStateExtractor.js # COPY verbatim
│   │   ├── stanceExtractor.js    # COPY verbatim
│   │   ├── debateExtractor.js    # COPY verbatim
│   │   ├── globalMemory.js       # COPY verbatim
│   │   ├── memorySearch.js       # COPY verbatim
│   │   ├── postChatProcessor.js  # COPY verbatim
│   │   ├── worldSnapshotService.js # COPY verbatim
│   │   └── extractionModelManager.js # COPY verbatim
│   ├── world/
│   │   ├── worldManager.js       # list/load/save worlds + external CHAT_TEMPLATES_DIR
│   │   └── settingsManager.js    # In-memory settings, debounced active.json write
│   ├── session/
│   │   └── sessionManager.js     # create/switch/archive sessions, wraps DB
│   ├── ui/                       # Ink terminal UI components
│   │   ├── App.jsx               # Root component: layout, mode switching
│   │   ├── ChatView.jsx          # Scrollable message history
│   │   ├── InputBox.jsx          # Bordered input (the Claude Code-style bar)
│   │   ├── Message.jsx           # Individual message bubble (user / assistant)
│   │   ├── StatusBar.jsx         # Top bar: world name, model, session
│   │   └── CommandOutput.jsx     # Output area for slash command results
│   ├── commands/
│   │   ├── registry.js           # CommandRegistry: Map<name, CommandDefinition>
│   │   ├── index.js              # Barrel: registers all commands
│   │   ├── world.js              # /worlds, /load <id>, /world (show active)
│   │   ├── model.js              # /model, /models, /pull
│   │   ├── session.js            # /new, /sessions, /switch
│   │   ├── memory.js             # /memory, /notes, /forget, /search
│   │   ├── settings.js           # /settings, /set <key> <value>
│   │   ├── system.js             # /help, /exit, /status, /version
│   │   └── export.js             # /export (markdown session dump)
│   ├── api/                      # Loaded only with --api flag
│   │   ├── server.js             # Express setup, mounts routes
│   │   └── routes/               # Thin HTTP wrappers over core engine
│   │       ├── chat.js           # POST /api/chat (SSE)
│   │       ├── sessions.js       # Adapted from chat/routes/sessions.js
│   │       ├── templates.js      # Adapted from chat/routes/templates.js
│   │       ├── memory.js         # Adapted from chat/routes/memory.js
│   │       └── models.js         # GET /api/models, POST /api/models/pull
│   └── config/
│       └── index.js              # PORT, OLLAMA_URL, CHAT_TEMPLATES_DIR, etc.
├── data/
│   ├── oread.db                  # SQLite (gitignored)
│   ├── templates/
│   │   ├── active.json           # Active world settings
│   │   └── user/                 # User-created worlds (gitignored)
│   └── templates/defaults/       # Copy of the 22 world JSONs from chat/
├── docs/
│   └── plan.md                   # This file
├── .env.example
├── .gitignore
└── package.json
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "ink": "^5.0.1",
    "ink-text-input": "^6.0.0",
    "react": "^18.3.1",
    "ollama": "^0.6.3",
    "@anthropic-ai/sdk": "^0.24.0",
    "openai": "^4.47.0",
    "sqlite": "^5.1.1",
    "sqlite3": "^5.0.2",
    "uuid": "^13.0.0",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^8.1.0",
    "joi": "^18.0.2"
  }
}
```

---

## Implementation Phases

### Phase 1 — Functional MVP
Working terminal UI: chat with Ollama using a world, session persisted to SQLite.

1. Scaffold: `package.json` (`"type": "module"`), `bin/oread.js` shebang entry
2. Copy services from `chat/services/` — change only `database.js` DB path
3. `worldManager.js` — reads `data/templates/defaults/` + `user/` + optional `CHAT_TEMPLATES_DIR`
4. `settingsManager.js` — holds active settings in memory, writes `active.json` with 1s debounce
5. `sessionManager.js` — thin wrapper over DB: create/list/switch/archive
6. `promptBuilder.js` — port `chat/client/src/utils/promptBuilder.js` (remove React/Zustand, pure function)
7. `chatPipeline.js` — extract the body of `POST /api/chat` from `chat/server.js` into standalone function
8. `src/ui/` — Ink components: App, ChatView, InputBox (bordered), StatusBar, Message
9. Command registry + core commands: `/help /exit /worlds /load /model /models /new /sessions /switch /status`
10. `engine.js` — init sequence: `db.initialize()` → `extractionModelManager.initialize()` → context singleton
11. `bin/oread.js` — parse argv, call engine init, render Ink app

**End state:** `npm link && oread` → bordered terminal UI, streaming chat, session saved to SQLite.

### Phase 2 — Memory + Full Commands
`/memory`, `/notes`, `/forget`, `/settings`, `/set`, `/export`, `/search`, `/pin`, `/unpin`. World snapshots on session create/archive.

### Phase 3 — Cloud Providers
`ProviderAdapter` factory: `claude-*` → Anthropic, `gpt-*` → OpenAI, bare → Ollama. API keys encrypted in SQLite. `/key set <provider> <key>` command.

### Phase 4 — HTTP API Layer
`src/api/` Express server on `--api` flag (port 3002). Routes call core engine. CORS allows `:5173`. Chat GUI changes one line in `vite.config.js` → CLI becomes the backend.

---

## Critical Files to Reference During Build

| Purpose | Source File |
|---|---|
| DB schema (copy) | `chat/services/database.js` |
| Post-turn pipeline (copy) | `chat/services/postChatProcessor.js` |
| Context window assembly (copy) | `chat/services/contextWindow.js` |
| Chat turn reference | `chat/server.js` → `POST /api/chat` handler |
| Prompt assembly (port) | `chat/client/src/utils/promptBuilder.js` |
| World JSON schema | `chat/data/templates/defaults/fantasy-tavern.json` |
| Active settings pattern | `chat/controllers/templateController.js` |

---

## Key Gotchas

- `postChatProcessor` is fire-and-forget — `setImmediate()`, never `await` it
- `extractionModelManager.initialize()` must complete before any extraction; chat still works if not ready (graceful degradation)
- `OLLAMA_MAX_LOADED_MODELS=2` required to keep chat + extraction models warm simultaneously
- Ink re-renders the full component tree on state change — stream chunks update a state array, not `process.stdout.write`
- FTS5 triggers must be in the same migration block — carry from `database.js` verbatim
- Legacy event format in world state: `typeof event === 'string'` check before accessing `.text` — in `contextWindow.js`, copy exactly
- Separate `data/oread.db` from `chat/chat.db` — no shared SQLite; migrate in Phase 4

---

## Verification

1. `npm link && oread` — bordered terminal UI renders
2. `/models` — lists Ollama models in the UI
3. `/load fantasy-tavern` then send a message — streaming response appears chunk by chunk
4. Kill and restart — `/sessions`, `/switch <id>` — previous session loads with context
5. After several turns, SQLite has facts/summary — verify with `/memory`
6. `oread --api` — `curl localhost:3002/api/health` returns OK
