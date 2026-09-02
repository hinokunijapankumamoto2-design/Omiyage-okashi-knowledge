/**
 * Schema is expressed as an ordered list of idempotent migrations.
 * Each entry runs once; `applied_migrations` records what a database has seen,
 * so an existing .sqlite upgrades in place without a dump/restore.
 */
export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: "0001-core",
    sql: `
CREATE TABLE departments (
  id            TEXT PRIMARY KEY,
  pack_key      TEXT NOT NULL DEFAULT 'software',
  code          TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  name_ja       TEXT NOT NULL DEFAULT '',
  name_ko       TEXT NOT NULL DEFAULT '',
  name_zh       TEXT NOT NULL DEFAULT '',
  mission       TEXT NOT NULL DEFAULT '',
  accent        TEXT NOT NULL DEFAULT '#6c8cff',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE (pack_key, code)
);

CREATE TABLE staff (
  id                 TEXT PRIMARY KEY,
  department_id      TEXT REFERENCES departments(id) ON DELETE SET NULL,
  display_name       TEXT NOT NULL,
  name_ja            TEXT NOT NULL DEFAULT '',
  name_ko            TEXT NOT NULL DEFAULT '',
  name_zh            TEXT NOT NULL DEFAULT '',
  seniority          TEXT NOT NULL DEFAULT 'associate'
                       CHECK (seniority IN ('lead', 'senior', 'associate', 'trainee')),
  is_coordinator     INTEGER NOT NULL DEFAULT 0 CHECK (is_coordinator IN (0, 1)),
  runner_kind        TEXT NOT NULL DEFAULT 'cli' CHECK (runner_kind IN ('cli', 'http', 'manual')),
  runner_id          TEXT NOT NULL DEFAULT 'claude-code',
  model              TEXT NOT NULL DEFAULT '',
  credential_id      TEXT,
  temperament        TEXT NOT NULL DEFAULT '',
  avatar_seed        INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'idle'
                       CHECK (status IN ('idle', 'working', 'meeting', 'break', 'offline')),
  active_task_id     TEXT,
  xp                 INTEGER NOT NULL DEFAULT 0,
  completed_tasks    INTEGER NOT NULL DEFAULT 0,
  failed_tasks       INTEGER NOT NULL DEFAULT 0,
  hired_at           INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at         INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_staff_department ON staff (department_id);
CREATE INDEX idx_staff_status ON staff (status);

CREATE TABLE projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  root_path     TEXT NOT NULL,
  objective     TEXT NOT NULL DEFAULT '',
  pack_key      TEXT NOT NULL DEFAULT 'software',
  vcs           TEXT NOT NULL DEFAULT 'git' CHECK (vcs IN ('git', 'none')),
  base_branch   TEXT NOT NULL DEFAULT '',
  isolation     TEXT NOT NULL DEFAULT 'worktree' CHECK (isolation IN ('worktree', 'inplace')),
  archived      INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  last_used_at  INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  staff_id   TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, staff_id)
);

CREATE TABLE tasks (
  id                TEXT PRIMARY KEY,
  project_id        TEXT REFERENCES projects(id) ON DELETE SET NULL,
  parent_task_id    TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  brief             TEXT NOT NULL DEFAULT '',
  acceptance        TEXT NOT NULL DEFAULT '',
  stage             TEXT NOT NULL DEFAULT 'inbox'
                      CHECK (stage IN ('inbox', 'planning', 'aligning', 'running',
                                       'review', 'done', 'blocked', 'cancelled')),
  priority          INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 0 AND 4),
  department_id     TEXT REFERENCES departments(id) ON DELETE SET NULL,
  assignee_id       TEXT REFERENCES staff(id) ON DELETE SET NULL,
  requested_by      TEXT NOT NULL DEFAULT 'ceo',
  workspace_path    TEXT NOT NULL DEFAULT '',
  branch            TEXT NOT NULL DEFAULT '',
  review_round      INTEGER NOT NULL DEFAULT 0,
  review_verdict    TEXT NOT NULL DEFAULT '',
  result_summary    TEXT NOT NULL DEFAULT '',
  failure_reason    TEXT NOT NULL DEFAULT '',
  hidden            INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  started_at        INTEGER,
  finished_at       INTEGER,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_tasks_stage ON tasks (stage, hidden);
CREATE INDEX idx_tasks_project ON tasks (project_id);
CREATE INDEX idx_tasks_assignee ON tasks (assignee_id);
CREATE INDEX idx_tasks_parent ON tasks (parent_task_id);

CREATE TABLE task_runs (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  staff_id      TEXT REFERENCES staff(id) ON DELETE SET NULL,
  runner_kind   TEXT NOT NULL,
  runner_id     TEXT NOT NULL,
  model         TEXT NOT NULL DEFAULT '',
  attempt       INTEGER NOT NULL DEFAULT 1,
  state         TEXT NOT NULL DEFAULT 'queued'
                  CHECK (state IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'timeout')),
  pid           INTEGER,
  exit_code     INTEGER,
  prompt        TEXT NOT NULL DEFAULT '',
  output_tail   TEXT NOT NULL DEFAULT '',
  log_file      TEXT NOT NULL DEFAULT '',
  started_at    INTEGER,
  finished_at   INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_runs_task ON task_runs (task_id);
CREATE INDEX idx_runs_state ON task_runs (state);

CREATE TABLE messages (
  id            TEXT PRIMARY KEY,
  channel       TEXT NOT NULL DEFAULT 'lobby',
  task_id       TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  author_kind   TEXT NOT NULL DEFAULT 'staff'
                  CHECK (author_kind IN ('ceo', 'staff', 'system')),
  author_id     TEXT,
  body          TEXT NOT NULL,
  directive     TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_messages_channel ON messages (channel, created_at);

CREATE TABLE meetings (
  id            TEXT PRIMARY KEY,
  task_id       TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
  topic         TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'kickoff'
                  CHECK (kind IN ('kickoff', 'standup', 'review', 'retro', 'adhoc')),
  state         TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')),
  summary       TEXT NOT NULL DEFAULT '',
  decisions     TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  closed_at     INTEGER
);

CREATE TABLE meeting_notes (
  id            TEXT PRIMARY KEY,
  meeting_id    TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  staff_id      TEXT REFERENCES staff(id) ON DELETE SET NULL,
  role_label    TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_meeting_notes_meeting ON meeting_notes (meeting_id);

CREATE TABLE reports (
  id            TEXT PRIMARY KEY,
  task_id       TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  staff_id      TEXT REFERENCES staff(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  artifacts     TEXT NOT NULL DEFAULT '[]',
  archived      INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE skills (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',
  summary       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  origin        TEXT NOT NULL DEFAULT 'builtin' CHECK (origin IN ('builtin', 'custom')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE staff_skills (
  staff_id   TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  skill_id   TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level      INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  learned_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (staff_id, skill_id)
);

CREATE TABLE credentials (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  runner_kind   TEXT NOT NULL DEFAULT 'http' CHECK (runner_kind IN ('cli', 'http')),
  runner_id     TEXT NOT NULL,
  base_url      TEXT NOT NULL DEFAULT '',
  secret_enc    TEXT NOT NULL DEFAULT '',
  secret_hint   TEXT NOT NULL DEFAULT '',
  default_model TEXT NOT NULL DEFAULT '',
  extra         TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor      TEXT NOT NULL DEFAULT 'ceo',
  action     TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_audit_created ON audit_log (created_at);
`,
  },
];
