# Architecture

## Layout

```
agent-guild/
├── server/
│   ├── index.ts              boot: migrate, seed, reconcile orphan runs, listen
│   ├── env.ts                .env reader + typed config
│   ├── core/                 ids, logger, errors, event bus, AES-GCM crypto
│   ├── db/                   node:sqlite handle, ordered migrations, seed
│   ├── domain/               packs, departments, staff, projects, tasks,
│   │                         messages, meetings, reports, skills, credentials, stats
│   ├── providers/            runner registry + CLI adapter + HTTP adapter
│   ├── engine/               git/worktree, prompt builder, report parsers,
│   │                         run store, dispatcher, directive language
│   ├── http/                 express app + five routers
│   └── ws/                   one WebSocket endpoint with a replay buffer
└── src/
    ├── api/                  fetch client, typed DTOs, reconnecting event stream
    ├── state/                one context store, event-driven coalesced refetch
    ├── office/               palette, floor plan, procedural sprite, canvas renderer
    ├── i18n/                 ja / en / ko / zh dictionaries
    └── components/           office, board, dashboard, chat, staff, skills, projects, settings
```

## Data model

Twelve tables, created by one ordered migration list. `applied_migrations` records what a database has
already seen, so an existing file upgrades in place.

```
departments ─┬─< staff ─┬─< staff_skills >─ skills
             │          └─< task_runs
             └─< tasks ─┬─< tasks (parent_task_id, subtasks)
                        ├─< task_runs
                        ├─< messages
                        ├─< meetings ─< meeting_notes
                        └─< reports
projects ─< project_members >─ staff
credentials, settings, audit_log
```

Ids are prefixed and time-ordered (`tsk_<base36 time><random>`), readable in logs and stable as TEXT
primary keys.

## The dispatcher

`server/engine/dispatcher.ts` is the only place that starts work. It holds an in-process queue and a
concurrency limit (`AG_MAX_CONCURRENT_RUNS`), and runs three modes against the same machinery:

| Mode | Prompt | Settles into |
| --- | --- | --- |
| `plan` | `buildPlanningPrompt` | subtasks created, parent → `aligning` |
| `work` | `buildWorkerPrompt` | `review` on success, `blocked` on failure |
| `review` | `buildReviewPrompt` | `done`, back to `work`, or `blocked` |

Every mode records a `task_runs` row, streams output to both a log file and the event bus, and settles
by parsing the agent's response block. An unreadable review verdict parks the task rather than passing
it — silence is never treated as approval.

## Prompt assembly

One function builds every worker prompt (`server/engine/prompt.ts`), so CLI and HTTP runners receive
identical instructions:

1. identity and working style, from the staff row
2. assignment, brief and acceptance criteria
3. the workspace path the agent is confined to
4. the pack's execution rules
5. the body of every skill the member has learned
6. any notes threaded in from a previous review round
7. the required response format

## Isolation

For a git project with `isolation: worktree`, each task gets `<root>/.guild-worktrees/<taskId>` on a
`guild/<slug>-<short id>` branch. Concurrent agents never share a checkout; a rejected run is removed
with `git worktree remove --force` plus a branch delete, leaving the original tree untouched.

## Realtime

A single WebSocket at `/events` carries every update as `{ id, at, event }`. The server keeps the last
200 envelopes; a reconnecting client sends `{ type: "resume", lastEventId }` and receives only what it
missed. The browser store coalesces a burst of events into one refetch on a 250 ms timer, so streaming
terminal output does not trigger a request per chunk.

## Rendering

No sprite sheet exists. `src/office/sprite.ts` composes a 10×14 cell grid of coloured rectangles per
frame; colours come from `paletteFor(seed)`, a xorshift32 PRNG keyed on the staff member's
`avatar_seed`, so a member always looks the same. `src/office/layout.ts` derives the floor plan from
the live department list, and the renderer draws in three passes — floors, monitors, actors sorted by
depth, then desk fronts — so a seated agent reads as being behind their desk.
