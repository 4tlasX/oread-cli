# oread-cli

Local-first LLM terminal interface. Ink-based terminal UI (Claude Code style), Ollama + cloud provider support, SQLite memory, slash command system.

## Stack

- **Runtime**: Node.js (ES Modules, `"type": "module"`)
- **UI**: Ink 5 (React for terminals), ink-text-input
- **Build**: esbuild (JSX compilation + bundling → `dist/oread.js`)
- **AI**: Ollama (local default), Anthropic, OpenAI, Cloudflare Workers AI (opt-in via `/key set`)
- **Storage**: SQLite (WAL mode, FTS5) via `sqlite` + `sqlite3`
- **Entry**: `bin/oread.js` → `dist/oread.js` (linked via `npm link`)

## Running

```bash
OLLAMA_MAX_LOADED_MODELS=2 ollama serve   # Keep chat + extraction models warm simultaneously
npm run build                              # Required after any source change
npm link                                   # Once — makes `oread` available globally
oread                                      # Terminal UI
oread --api --no-repl                      # API server only on :3002
oread --api                                # Both
```

## Project structure

```
bin/oread.js              Entry: parses --api/--no-repl/--port flags, calls initialize(), renders Ink or starts server
src/
  config/index.js         CONFIG object — PORT, OLLAMA_URL, DATA_DIR (uses process.env.OREAD_ROOT)
  core/
    engine.js             Singleton: initializes all services → exports context object
    chatPipeline.js       Async generator runChatTurn() — one full turn, yields text chunks
    promptBuilder.js      Pure function: buildSystemPrompt(settings, mode, isFirstMessage)
    personalitySystemLoader.js  Trait definitions (JSON bundled via static import)
    narrativeSystemLoader.js    Narrative style definitions (JSON bundled via static import)
  services/
    database.js           SQLite init, schema, WAL mode — DB at data/oread.db
    ollama.js             OllamaService: chat(), extract(), listModels(), pullModel(), checkHealth()
    extractionModelManager.js   Singleton: downloads phi4-mini in background, getStatus(), initialize()
    contextWindow.js      selectMessages() — token-budgeted 9-level priority context assembly
    factExtractor.js      phi4-mini fact extraction (people, places, events, facts)
    summarizer.js         Rolling summarization (Ollama, every 20→15 messages, background)
    worldStateExtractor.js  extractWorldState() / extractSessionState() — mode-aware
    stanceExtractor.js    Zero-inference regex stance detection (roleplay only)
    debateExtractor.js    Debate/disagreement tracking (Ollama, every 10 turns, background)
    globalMemory.js       promoteToGlobalMemory(), getRelevantGlobalMemories(), updateRelationship()
    memorySearch.js       searchMessages() FTS5, detectRecallTriggers() regex
    postChatProcessor.js  Orchestrates all 6 extractors — always setImmediate(), never await
    worldSnapshotService.js  createWorldSnapshot(), getWorldSnapshot(), seedWorldState()
    keyStore.js           AES-256-GCM encrypted API key storage in SQLite api_keys table
    providers/
      index.js            Routes by model prefix: claude-* → Anthropic, gpt-* → OpenAI, nomi-* → Nomi.ai, kindroid-* → Kindroid.ai, @cf/* → Cloudflare, else Ollama
      ollama.js           Adapter — wraps OllamaService.chat()
      anthropic.js        Adapter — @anthropic-ai/sdk streaming
      openai.js           Adapter — openai npm streaming
      nomi.js             Adapter — Nomi.ai REST API (nomi-* prefix, NOMI_API_KEY / NOMI_MODEL)
      kindroid.js         Adapter — Kindroid.ai REST API (kindroid-* prefix, KINDROID_API_KEY / KINDROID_MODEL)
      cloudflare.js       Adapter — Cloudflare Workers AI SSE streaming (@cf/* prefix, CF_ACCOUNT_ID / CF_API_TOKEN); enforceAlternation() merges consecutive same-role messages and preserves system prompt
      shapefirst.js       Shape-First beta provider — resolveShapefirstKey() (CF env vars auto-resolved), summarizeWithGateway() (native /ai/run/{model} endpoint); strips <think> blocks from reasoning models
    chainStore.js         storeChain(), getRelevantChains() keyword LIKE match, getChainsBySession()
    chainExtractor.js     runChainSummary() — fetches last 20 msgs + 3 prior chains, calls gateway, stores result
    responseGuard.js      sanitizeChunk() (per-chunk ANSI/escape strip) + detectInjection() (full-response prompt-injection scan)
  world/
    worldManager.js       listWorlds(), loadWorld(id), saveUserWorld(), deleteUserWorld(), getActive(), setActive(), updateUserWorldField(id, keyPath, value) — targeted field update without full rewrite; stale placeholder model IDs are sanitized on load
    settingsManager.js    In-memory settings, 1s debounced write to data/templates/active.json
  session/
    sessionManager.js     createSession(), listSessions(), switchSession(), getCurrentSession()
  ui/                     Ink components — NO direct DB or service imports here; access services via context object
    App.jsx               Root: state (messages, streamingContent, isStreaming, status, sessionName, selectOverlay, pullState)
                          refreshStatus() called after every command + chat turn to keep status bar live
                          InputBox always visible; SelectOverlay and PullProgress layer on top when active
    StatusBar.jsx         Bar above input: world • model • session; display values are ANSI-stripped
    ChatView.jsx          Message history using <Static> for completed messages
    Message.jsx           Role labels padded to same width for column alignment
    InputBox.jsx          Top + bottom borders only (Ink borderStyle="single"), drawn with useStdout width
    CommandPicker.jsx     Autocomplete list shown below InputBox while typing; ASCII '> ' indicator, wrap="truncate", 5 items + scroll hints
    SelectOverlay.jsx     Full-height picker (same style as CommandPicker) shown for /model, /worlds, /sessions no-arg
    PullProgress.jsx      Progress bar shown while /pull is downloading; ESC cancels
    stdout.js             Direct stdout helpers (printWelcome, printCommandOutput, printNote, clearScreen) — writes outside Ink's live region
  commands/
    registry.js           CommandRegistry: Map<name, def>, aliases supported, execute() returns { output: string }; /help uses two-column layout
    index.js              Registers all command modules
    world.js              /worlds — SelectOverlay picker; /world [id] — show active or load world + create session + show recent
    model.js              /model — SelectOverlay picker + lists all providers grouped; /model <name> — switch + auto-saves to user world JSON; /models — alias; /pull <name-or-hf-url> — download
    session.js            /sessions — SelectOverlay picker; /session [id-or-name] — show or switch; /new [name] — create
    memory.js             /memory [chains|global], /forget, /search, /pin, /unpin
    summarize.js          /summarize — Shape-First manual trigger; checks enabled flag + credentials before running
    notes.js              /notes [set|clear]
    settings.js           /settings [key], /set <key> <value>
    export.js             /export [filename] → data/exports/
    keys.js               /key set|list|remove
    system.js             /help, /exit, /status (full: world + session + model + memory stats)
  api/                    Express layer — loaded only when --api flag is set
    server.js             createServer(), startServer(port) — binds 127.0.0.1 only
    middleware/
      errorHandler.js     asyncHandler(), errorHandler, notFoundHandler, NotFoundError
    routes/
      chat.js             POST /api/chat — SSE, calls runChatTurn(); max message length 32000 chars
      sessions.js         Full CRUD + notes + world-state + search
      templates.js        Worlds list/get + active settings get/set/reset + user world CRUD
      memory.js           Global memory CRUD + search + promote + relationships
      models.js           GET /api/models (all providers) + POST /api/models/pull (SSE)
data/
  oread.db                SQLite database (gitignored)
  templates/
    defaults/             22 built-in world JSONs (copied from chat app)
    user/                 User-created worlds (gitignored)
    active.json           Active settings snapshot (gitignored)
  exports/                /export command output
  .secret                 Auto-generated AES encryption key (chmod 600, gitignored)
docs/
  plan.md                 Original implementation plan
```

## Key architecture rules

**Core engine is framework-agnostic.** `src/core/`, `src/services/`, `src/world/`, `src/session/` have zero Ink/React/Express imports. Both interface layers (UI and HTTP) call into the same engine.

**postChatProcessor is always fire-and-forget.** Call it with `setImmediate()`, never `await`. Summarization and debate extraction are background — they must not block the chat response.

**Streaming shape.** All provider adapters yield `{ message: { content: string } }` — the same shape as the Ollama native response. `chatPipeline.js` reads `chunk.message?.content` and the UI reads the same chunks.

**Command handlers return strings or action objects.** `registry.execute()` returns `{ output, action?, content? }`. String results render as command output. Supported actions: `clear`, `pager` (content = text), `select` (content = `{ label, items, resolveCommand }`), `pull` (content = `{ modelName }`). Commands never import Ink components — the UI layer handles all rendering.

**JSON data files are static imports.** `personalitySystemLoader.js` and `narrativeSystemLoader.js` use `import data from './file.json' with { type: 'json' }` so esbuild bundles the JSON inline. Never use `readFileSync` with `__dirname` in bundled code — paths resolve to `dist/` after bundling.

**Build required after source changes.** Source is `src/` + `bin/`. Output is `dist/oread.js`. The linked `oread` binary runs the compiled output. Run `npm run build` after any edit.

## Database schema (SQLite, WAL mode)

```
sessions          id, name, character_name, mode, settings_snapshot, message_count,
                  story_notes, extracted_facts (JSON), rolling_summary,
                  world_state (JSON), world_state_history (JSON), character_stances (JSON),
                  archived, created_at, updated_at

messages          id, session_id (FK), role, content, timestamp, pinned (0/1)
messages_fts      Virtual FTS5 — auto-synced via triggers

global_memory     id, entity_type, entity_key (UNIQUE), content, confidence, access_count
global_memory_fts Virtual FTS5

character_relationships  character_name, user_name (UNIQUE pair), relationship_summary,
                         trust_level, interaction_count, key_moments (JSON)

world_snapshots   id, template_id, character_name, source_session_id, world_state_summary,
                  key_locations, key_characters, key_events

api_keys          provider (PK), encrypted_key, iv, auth_tag (AES-256-GCM)

logic_chains      id, session_id (FK), turn INTEGER, chain_text TEXT, reason TEXT ('periodic'|'significant'|'manual'),
                  created_at DATETIME
                  INDEX: idx_logic_chains_session (session_id, turn DESC)
```

## Chat pipeline flow

```
User input → handleSubmit (App.jsx)
  → if slash: commandRegistry.execute() → commandOutput state
  → else: runChatTurn({ userMessage, context })
      → sessionManager.getCurrentSession()
      → load DB messages
      → buildSystemPrompt(settings, mode, isFirstMessage)
      → detectRecallTriggers() → searchMessages() if triggered
      → getRelevantGlobalMemories() if crossSessionMemory enabled
      → selectMessages() — token-budgeted context window
      → providerChat(model, messages, options) → async generator
          → routes to Ollama / Anthropic / OpenAI by model name prefix
      → yield chunks → App.jsx streamingContent state → InputBox grayed
      → stream ends → push to messages[] → clear streamingContent
      → saveMessageToSession() x2 (user + assistant)
      → setImmediate(processPostChat)
          → factExtractor (phi4-mini)
          → summarizer (Ollama, conditional)
          → worldStateExtractor / sessionStateExtractor (phi4-mini)
          → stanceExtractor (regex, roleplay only)
          → debateExtractor (Ollama, every 10 turns)
          → promoteToGlobalMemory (if crossSessionMemory)
          → runChainSummary (if shapeFirstMemory=true, every 7 turns or significant world state change)
```

## Context window priorities

1. System prompt (always included)
2. Rolling summary (≤15% of remaining budget)
3. World state + character stances (≤5%)
4. Story notes + extracted facts (≤10%)
5. Global memory + relationship history (≤10%)
6. Anchor messages (first user + first assistant)
7. Pinned messages (newest-first)
8. Recalled messages (FTS5 triggered by "remember when..." patterns)
9. Recent messages (fill remaining budget, newest→oldest)

## Settings key paths (for /set command)

```
mode                              'normal' | 'roleplay'
general.selectedModel             'llama3.2' | 'claude-sonnet-4-6' | 'gpt-4o' | ...
general.temperature               0.0 – 2.0
general.topP                      0.0 – 1.0
general.maxTokens                 integer
general.contextBudget             integer (tokens)
general.autoSummarize             true | false
general.crossSessionMemory        true | false
general.webSearch                 true | false
general.shapeFirstMemory          true | false (default false — opt-in beta; requires CF_ACCOUNT_ID + CF_API_TOKEN)
roleplay.world.narratorVoice      'companion' | 'omniscient' | 'third_person_limited' | ...
userPersona.name                  string
```

## World JSON schema

```json
{
  "id": "my-world",
  "name": "My World",
  "settings": {
    "mode": "roleplay",
    "roleplay": {
      "world": { "settingLore": "", "openingScene": "", "narratorVoice": "companion", "hardRules": [] },
      "characterMode": "single",
      "characters": [{ "name": "", "age": "", "role": "", "traits": {}, "backstory": "" }]
    },
    "utility": {
      "assistantIdentity": { "persona": "", "communicationStyle": "" },
      "guardrails": { "negativeConstraints": "", "formattingPreferences": "" }
    },
    "userPersona": { "name": "", "bio": "", "skills": "", "profession": "" },
    "general": { "selectedModel": null, "temperature": 0.8, "topP": 0.9, "maxTokens": 2048 },
    "meta": { "templateId": "my-world", "version": "1.0.0" }
  }
}
```

Drop files matching this schema into `data/templates/user/` or set `CHAT_TEMPLATES_DIR` to load from an external directory.

## Connecting the chat GUI (Phase 4 / future)

Change one line in `chat/client/vite.config.js`:
```js
proxy: { '/api': 'http://localhost:3002' }  // was 3001
```
Run `oread --api --no-repl`. The chat GUI talks to this CLI as its backend. `chat/server.js` is retired.

## API key resolution

Cloud provider keys are resolved in this order:
1. Encrypted DB key (set via `/key set <provider> <key>`)
2. Environment variable (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `NOMI_API_KEY`, `KINDROID_API_KEY`)
3. Error — no key found

Supported providers: `anthropic`, `openai`, `gemini`, `groq`, `nomi`, `kindroid`, `cloudflare`.

**Cloudflare is a special case** — it requires both an account ID and an API token. Store them combined: `/key set cloudflare <accountId>:<apiToken>`. Env var fallback uses two vars: `CF_ACCOUNT_ID` + `CF_API_TOKEN` (both must be set). The `resolveKey('cloudflare')` path in `providers/index.js` handles this split.

This logic lives in `src/services/providers/index.js` `resolveKey()`. Both `chat()` and `listAllModels()` use it.

Keys are validated before storage: printable ASCII only, 8–512 characters.

## Gotchas

- **Build before running.** `src/` changes don't take effect until `npm run build`.
- **OREAD_ROOT must be set before any imports.** `bin/oread.js` sets `process.env.OREAD_ROOT` at the very top. Every service (`database`, `worldManager`, `keyStore`, `export`) reads this for data paths. Never use `import.meta.url` for path resolution in bundled code — after esbuild all `import.meta.url` calls resolve to `dist/oread.js`, making relative paths wrong.
- **phi4-mini download.** Extraction is skipped gracefully if the model isn't ready — chat still works.
- **Two models in Ollama.** `OLLAMA_MAX_LOADED_MODELS=2` prevents the extraction model from evicting the chat model on each turn.
- **Status bar reactivity.** `App.jsx` calls `refreshStatus()` after every command and chat turn. This re-reads world name, model, and session name from context. Session name requires an async DB call — initialized via `useEffect` on mount, updated via `refreshStatus` thereafter.
- **SelectOverlay vs CommandPicker.** `CommandPicker` shows while typing (inline autocomplete, below the input box). `SelectOverlay` appears after a command returns `action: 'select'` — both coexist with the always-visible `InputBox`; they are never on screen at the same time as each other.
- **PullProgress.** Also replaces `InputBox` while active. `pullCancelledRef` is a ref (not state) so the async generator loop can read it without stale closures. On cancel the ref is set and the loop breaks on next iteration — the Ollama pull continues server-side but the UI stops tracking it.
- **HuggingFace URL normalization.** In `model.js` `normalizeModelName()`. Resolve URLs (`.../resolve/main/model.gguf`) become `hf.co/user/repo:model`. Plain `huggingface.co/` prefixes become `hf.co/`. Plain Ollama names are unchanged.
- **context.ollamaService.** Added to the context object in `engine.js` so UI can call `pullModel()` without importing the service directly.
- **Raw mode error in non-TTY.** Expected when running backgrounded or piped. Works correctly in an interactive terminal.
- **API binds localhost only.** `127.0.0.1` — not accessible from the network without a reverse proxy.
- **Legacy event format.** World state `ongoingEvents` may contain plain strings or `{ text, state }` objects. The `typeof` guard in `contextWindow.js` handles both — copy it exactly if reimplementing.
- **responseGuard in chatPipeline.** `sanitizeChunk()` is called on every streamed chunk before it reaches the UI. `detectInjection()` is called on the full assembled response before it is saved. Both live in `src/services/responseGuard.js`.
- **Cloudflare credential format.** The keyStore holds one string per provider; Cloudflare needs two values so they are stored as `accountId:apiToken` (split on the first `:`). The env var fallback requires *both* `CF_ACCOUNT_ID` and `CF_API_TOKEN` to be set. Model names use the `@cf/` prefix (e.g. `@cf/meta/llama-3.1-8b-instruct-fast`); the model list is a curated hardcoded set — Cloudflare has hundreds of models but no concise endpoint.
- **Nomi / Kindroid model IDs.** These providers don't have named models — the "model name" (`nomi-<uuid>` or `kindroid-<id>`) encodes the companion ID. If no explicit model name is given, the adapter falls back to `NOMI_MODEL` / `KINDROID_MODEL` env vars. Stale `nomi-` / `kindroid-` IDs in `active.json` are stripped on load if no matching key is configured.
- **Model auto-saved to user world.** When the user switches model via `/model`, `updateUserWorldField()` writes `settings.general.selectedModel` back into the active user world's JSON file so the choice persists across restarts. This only fires for user worlds (not built-in defaults).
- **SelectOverlay and InputBox coexist.** Unlike the previous design, `InputBox` is always rendered. `SelectOverlay` and `PullProgress` render on top of it (not instead of it). This keeps the terminal layout stable during picker navigation.
- **CommandPicker below input.** The command picker now appears below the input box (not above). It shows up to 5 items with `↑ N more` / `↓ N more` scroll indicators and uses ASCII `> ` as the selection marker to avoid wide-char alignment issues.
