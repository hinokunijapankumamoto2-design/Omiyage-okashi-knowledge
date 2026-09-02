# Status and roadmap

Honest accounting of what v0.1 does and does not do, measured against the feature set of the
project analysed in `ANALYSIS.ja.md`.

## Implemented and verified

| Feature | Notes |
| --- | --- |
| Pixel office view | Canvas 2D, procedural characters, per-department rooms, meeting room, lounge, hover labels, click-to-inspect |
| Guild packs (6) | `software` / `document` / `research` / `narrative` / `film` / `persona`, declarative |
| Kanban board | 7 columns, drag between columns, server-side legal-transition table |
| Task lifecycle | plan → work → review → done, with revision rounds and a round cap |
| CEO chat + `$` directives | 12 verbs, flag parsing, inline help, autocompletion |
| Multi-provider execution | 5 CLI runners + 3 HTTP dialects, one registry entry each |
| Credential store | AES-256-GCM at rest, masked in the API, never returned to the browser |
| Realtime | WebSocket with replay-on-reconnect; live terminal streaming per task |
| git worktree isolation | per-task branch, auto-commit, merge, discard, diff |
| Staff management | hire, edit, dismiss, department assignment, runner/model binding, XP and levels |
| Department management | CRUD + reorder |
| Skill library | 24 built-in skills, per-member learn/unlearn, custom Markdown upload |
| Meetings + minutes | open, note, close; Markdown export |
| PPTX export | minutes, task reports and a guild status deck (`pptxgenjs`) |
| Reports archive | per-task run reports and review reports |
| Dashboard | KPIs, per-department load, leaderboard, recent activity |
| i18n | ja / en / ko / zh, auto-detected |
| Runner probe | detects which CLIs are actually installed |
| Safety | simulation mode, path allowlist, `shell: false`, run timeout, orphan-run reconciliation |
| Test suite | 39 vitest specs over directives, report parsing, packs, skills, stage transitions and the XP curve |
| Licence gate | `npm run license:check` fails the build if a copyleft or non-commercial dependency appears |

## Not yet implemented

These were in the analysed feature set but are **not** in v0.1. Each is additive — none requires
reworking the engine.

| Feature | Where it would go | Notes |
| --- | --- | --- |
| OAuth device flows (GitHub / Google) | `server/http/routes/providers.ts` + a `oauth_accounts` migration | The credential store and the `credentials` table already model the storage side |
| Messenger bridges (Telegram / Discord / Slack) | a `server/messenger/` module posting into `runDirective()` | The directive language is already the single entry point, so a bridge is a transport shim |
| GitHub repo import / clone UI | `server/http/routes/work.ts` | `createProject` already validates and probes a path |
| Scheduled / recurring meetings | `server/engine/` timer + `meetings` table | Meetings exist; only the scheduler is missing |
| AI-generated meeting minutes | a fourth dispatcher mode reusing `buildPlanningPrompt`'s shape | Notes and closing already exist |
| OpenAPI contract + Swagger UI | `server/http/` | Routes are grouped and typed; generation is mechanical |
| Docker packaging | `Dockerfile` + compose | No native dependencies, so this is a plain Node 22 image |
| In-app update notice | `server/http/routes/office.ts` | Needs a release feed to point at |
| Video pre-production rendering | deliberately **out of scope** | The `film` pack produces scripts and shot lists as text. Actual rendering was the one feature whose obvious library carries separate commercial terms — see `ANALYSIS.ja.md` §2.1. Bring your own renderer if you need it |

## Known limits

- The dispatcher queue is in-process. Restarting the server cancels queued and running work; orphaned
  `task_runs` rows are reconciled to `cancelled` on boot rather than resumed.
- There is no authentication. The server binds to `127.0.0.1` by default and is meant to stay there.
  Exposing it to a network requires putting an authenticating proxy in front.
- `workspaceDiff` shells out to `git diff HEAD` and truncates at 20 KB when it reaches a review prompt.
- Review round caps are global (`engine.reviewRounds`), not per-pack.
