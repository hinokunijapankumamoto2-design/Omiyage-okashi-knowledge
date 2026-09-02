# AgentGuild

**A local-first virtual company of AI agents. Dependency-clean, asset-free, MIT licensed.**

[日本語 README](README.ja.md)

AgentGuild organises terminal agents (Claude Code, Codex, Gemini CLI, OpenCode, any custom CLI) and
HTTP model APIs (OpenAI-compatible, Anthropic, Ollama) into a simulated software company: departments,
a task board, a review loop, isolated git worktrees, and a pixel office you can watch. You play the CEO.

> This is an independent reimplementation inspired by the feature set of `GreenSheep01201/claw-empire`.
> No code, schema or asset was copied — see [`docs/ANALYSIS.ja.md`](docs/ANALYSIS.ja.md) for the analysis
> and the licensing reasoning behind that decision.

- **No bundled assets.** No images, fonts or audio — characters are drawn procedurally at runtime.
- **7 runtime dependencies, all MIT.** No copyleft, no source-available commercial terms.
- **No native build step.** SQLite comes from Node 22's built-in `node:sqlite`.

---

## Requirements

- Node.js **22.5+** (for `node:sqlite`)
- git (for worktree isolation)
- Optional: one of `claude`, `codex`, `gemini`, `opencode` on your `PATH`

## Setup

```bash
cd agent-guild
npm install
cp .env.example .env
# recommended: generate the credential-encryption key
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

**Development**

```bash
npm run dev          # web on :5310, API on :5311
```

**Production**

```bash
npm run build && npm start   # SPA + API on :5311
```

The first boot seeds six packs of departments, eighteen staff members and twenty-four built-in skills.

---

## Using it

1. **Register a project** — Projects tab, absolute path to the directory agents may work in. A git repo
   defaults to `worktree` isolation: every task gets its own branch and checkout.
2. **File work** — from the CEO chat:

```
$task Add rate limiting --brief "Protect the public API" --accept "429 after 10 req/s" --dept build --prio 3
$plan  tsk_xxx      # let the planning lead decompose it into subtasks
$run   tsk_xxx      # queue it for execution
$review tsk_xxx     # send it to the reviewer
$merge tsk_xxx      # merge an accepted worktree back
$discard tsk_xxx    # throw the worktree and branch away
$help
```

Dragging a card between board columns performs the same transitions.

3. **Watch** — the Office tab shows who is at their desk and whose monitor is lit; opening a card streams
   the live terminal output of the running process over WebSocket.

---

## How a task flows

```
CEO directive
  └─ parsed (server/engine/directives.ts)
      └─ task created (stage: planning)
          ├─ $plan → coordinator returns JSON → subtasks created
          └─ $run  → dispatcher
                ├─ pick an assignee (department → idle → least loaded)
                ├─ open a git worktree on a task branch
                ├─ assemble the prompt (pack rules + learned skills + acceptance criteria)
                ├─ invoke the runner (CLI process or HTTP API)
                ├─ parse the GUILD-REPORT block
                ├─ commit the workspace
                └─ stage: review → reviewer returns GUILD-REVIEW
                      accept → done | revise → back to work | reject → blocked
```

### Guild packs

A pack is a company profile: departments, routing order, review checklist and prompt conventions.

| Key | Name | For |
| --- | --- | --- |
| `software` | Software Studio | the default engineering baseline |
| `document` | Document Bureau | reports, specs, manuals |
| `research` | Research Desk | citation-disciplined investigation |
| `narrative` | Narrative House | long-form fiction with continuity |
| `film` | Pre-production Unit | concept, script, shot list |
| `persona` | Persona Lab | character-driven conversation |

Adding one is a data entry in `server/domain/packs.ts` — the engine does not change.

### Runners

Declared as data in `server/providers/registry.ts`; two adapters cover everything.

- **CLI** — `claude`, `codex`, `gemini`, `opencode`, plus a configurable generic CLI
- **HTTP** — OpenAI-compatible (OpenAI, OpenRouter, Together, Groq, Cerebras, vLLM …), Anthropic, Ollama

API keys are encrypted with AES-256-GCM before they touch the database and are never returned to the
browser — only a masked hint is.

### The agent response contract

Workers end their reply with a block the office parses. The parser is tolerant, but a review whose
verdict cannot be read is **never auto-accepted** — it parks for a CEO decision.

```
GUILD-REPORT
status: done | blocked
summary: <one or two sentences>
changed: <comma separated paths, or none>
verified: <the command you ran, or none>
blocker: <only when status is blocked>
```

---

## Safety defaults

- `AG_ENABLE_EXECUTION=0` simulates the whole pipeline without spawning a process
- `AG_ALLOWED_ROOTS` restricts writable path prefixes (unset = registered projects only)
- CLIs are spawned with `shell: false`, so prompt text never reaches a shell parser
- Worktree isolation means a bad run is discarded without touching the original checkout
- `AG_RUN_TIMEOUT_MS` (default 30 min) kills a runaway process

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `AG_HOST` / `AG_PORT` | `127.0.0.1` / `5311` | API bind address |
| `AG_DB_PATH` | `.data/agent-guild.sqlite` | database file |
| `AG_SECRET_KEY` | *(unset)* | credential encryption key; derived from the machine if absent, with a UI warning |
| `AG_MAX_CONCURRENT_RUNS` | `3` | parallel agent processes |
| `AG_RUN_TIMEOUT_MS` | `1800000` | per-run wall clock limit |
| `AG_ENABLE_EXECUTION` | `1` | `0` for simulation |
| `AG_ALLOWED_ROOTS` | *(empty)* | comma-separated absolute path prefixes agents may write to |

## Docs

- [`docs/ANALYSIS.ja.md`](docs/ANALYSIS.ja.md) — source analysis and licensing reasoning (Japanese)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — internals
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what is and is not implemented
- [`docs/LICENSES.md`](docs/LICENSES.md) — dependency licence inventory

## Licence

MIT — see `LICENSE`.
