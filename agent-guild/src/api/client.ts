export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

async function request<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: payload === undefined ? {} : { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = parsed as ApiError | null;
    throw new Error(error?.message ?? `${method} ${path} failed (${response.status})`);
  }
  return parsed as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, payload?: unknown) => request<T>("POST", path, payload ?? {}),
  patch: <T>(path: string, payload: unknown) => request<T>("PATCH", path, payload),
  del: <T>(path: string) => request<T>("DELETE", path),
};

export interface Department {
  id: string;
  packKey: string;
  code: string;
  nameEn: string;
  nameJa: string;
  nameKo: string;
  nameZh: string;
  mission: string;
  accent: string;
  sortOrder: number;
  headcount: number;
}

export interface Staff {
  id: string;
  departmentId: string | null;
  departmentCode: string | null;
  departmentAccent: string | null;
  displayName: string;
  nameJa: string;
  seniority: "lead" | "senior" | "associate" | "trainee";
  isCoordinator: number;
  runnerKind: "cli" | "http" | "manual";
  runnerId: string;
  model: string;
  credentialId: string | null;
  temperament: string;
  avatarSeed: number;
  status: "idle" | "working" | "meeting" | "break" | "offline";
  activeTaskId: string | null;
  xp: number;
  level?: number;
  completedTasks: number;
  failedTasks: number;
}

export type Stage =
  | "inbox"
  | "planning"
  | "aligning"
  | "running"
  | "review"
  | "done"
  | "blocked"
  | "cancelled";

export interface Task {
  id: string;
  projectId: string | null;
  parentTaskId: string | null;
  title: string;
  brief: string;
  acceptance: string;
  stage: Stage;
  priority: number;
  departmentId: string | null;
  assigneeId: string | null;
  workspacePath: string;
  branch: string;
  reviewRound: number;
  reviewVerdict: string;
  resultSummary: string;
  failureReason: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  objective: string;
  packKey: string;
  vcs: "git" | "none";
  baseBranch: string;
  isolation: "worktree" | "inplace";
  members: string[];
}

export interface Message {
  id: string;
  channel: string;
  taskId: string | null;
  authorKind: "ceo" | "staff" | "system";
  authorId: string | null;
  authorName: string | null;
  body: string;
  directive: string;
  createdAt: number;
}

export interface Skill {
  id: string;
  slug: string;
  name: string;
  category: string;
  summary: string;
  body: string;
  origin: "builtin" | "custom";
  learners: number;
}

export interface Pack {
  key: string;
  nameEn: string;
  nameJa: string;
  badge: string;
  summary: string;
  pipeline: string[];
  coordinatorCode: string;
  reviewerCode: string;
}

export interface Stats {
  staff: { total: number; working: number; idle: number };
  tasks: Record<string, number>;
  throughput: { completedToday: number; completed7d: number; failed7d: number };
  meanRunSeconds: number;
  departments: Array<{ code: string; nameEn: string; accent: string; headcount: number; open: number; done: number }>;
  leaderboard: Array<{ id: string; displayName: string; xp: number; level: number; completedTasks: number }>;
}

export interface RunRecord {
  id: string;
  taskId: string;
  staffId: string | null;
  runnerId: string;
  state: string;
  attempt: number;
  outputTail: string;
  startedAt: number | null;
  finishedAt: number | null;
}
