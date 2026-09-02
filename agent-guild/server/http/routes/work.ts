import { Router } from "express";
import { body, flag, handler, param, str } from "../helpers.js";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "../../domain/projects.js";
import {
  boardSnapshot,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  reorderTasks,
  STAGES,
  subtasksOf,
  updateTask,
  type Stage,
} from "../../domain/tasks.js";
import { listRuns } from "../../engine/runs.js";
import { cancel, discardTask, enqueue, mergeTask, queueDepth, runningTaskIds, taskDiff } from "../../engine/dispatcher.js";
import { listReports, archiveReport } from "../../domain/reports.js";
import { listBranches } from "../../engine/git.js";
import { listTaskMessages } from "../../domain/messages.js";
import { listMeetings, getMeeting, openMeeting, addNote, closeMeeting, minutesMarkdown } from "../../domain/meetings.js";
import { badRequest } from "../../core/errors.js";

export const workRouter = Router();

workRouter.get("/projects", handler((req) => ({ projects: listProjects(flag(req, "archived")) })));
workRouter.get("/projects/:id", handler((req) => getProject(param(req, "id"))));
workRouter.post("/projects", handler((req) => createProject(body(req) as never)));
workRouter.patch("/projects/:id", handler((req) => updateProject(param(req, "id"), body(req))));
workRouter.delete(
  "/projects/:id",
  handler((req) => {
    deleteProject(param(req, "id"));
    return { ok: true };
  }),
);
workRouter.get(
  "/projects/:id/branches",
  handler((req) => ({ branches: listBranches(getProject(param(req, "id")).rootPath) })),
);

workRouter.get("/board", handler((req) => ({ stages: STAGES, board: boardSnapshot(str(req, "project")) })));

workRouter.get(
  "/tasks",
  handler((req) => ({
    tasks: listTasks({
      projectId: str(req, "project"),
      stage: str(req, "stage") as Stage | undefined,
      assigneeId: str(req, "assignee"),
      departmentId: str(req, "department"),
      includeHidden: flag(req, "hidden"),
    }),
  })),
);
workRouter.get(
  "/tasks/:id",
  handler((req) => ({
    task: getTask(param(req, "id")),
    subtasks: subtasksOf(param(req, "id")),
    runs: listRuns(param(req, "id")),
    reports: listReports({ taskId: param(req, "id") }),
    messages: listTaskMessages(param(req, "id")),
  })),
);
workRouter.post("/tasks", handler((req) => createTask(body(req) as never)));
workRouter.patch("/tasks/:id", handler((req) => updateTask(param(req, "id"), body(req))));
workRouter.delete(
  "/tasks/:id",
  handler((req) => {
    deleteTask(param(req, "id"));
    return { ok: true };
  }),
);
workRouter.post(
  "/tasks/reorder",
  handler((req) => {
    const payload = body(req);
    reorderTasks((payload.stage as Stage) ?? "inbox", (payload.ids as string[]) ?? []);
    return { ok: true };
  }),
);

workRouter.post(
  "/tasks/:id/run",
  handler((req) => {
    const mode = (body(req).mode as "work" | "review" | "plan") ?? "work";
    if (!["work", "review", "plan"].includes(mode)) throw badRequest("bad_mode", `unknown mode "${mode}"`);
    enqueue(param(req, "id"), mode, (body(req).notes as string[]) ?? []);
    return { ok: true, mode };
  }),
);
workRouter.post("/tasks/:id/stop", handler((req) => ({ stopped: cancel(param(req, "id")) })));
workRouter.get("/tasks/:id/diff", handler((req) => ({ diff: taskDiff(param(req, "id")) })));
workRouter.post("/tasks/:id/merge", handler((req) => ({ commit: mergeTask(param(req, "id")) })));
workRouter.post(
  "/tasks/:id/discard",
  handler((req) => {
    discardTask(param(req, "id"));
    return { ok: true };
  }),
);
workRouter.get("/tasks/:id/runs", handler((req) => ({ runs: listRuns(param(req, "id")) })));

workRouter.get("/queue", handler(() => ({ depth: queueDepth(), running: runningTaskIds() })));

workRouter.get("/reports", handler((req) => ({ reports: listReports({ archived: flag(req, "archived") }) })));
workRouter.post(
  "/reports/:id/archive",
  handler((req) => archiveReport(param(req, "id"), body(req).archived !== false)),
);

workRouter.get(
  "/meetings",
  handler((req) => ({ meetings: listMeetings({ taskId: str(req, "task"), projectId: str(req, "project") }) })),
);
workRouter.get("/meetings/:id", handler((req) => getMeeting(param(req, "id"))));
workRouter.get("/meetings/:id/minutes", handler((req) => ({ markdown: minutesMarkdown(param(req, "id")) })));
workRouter.post("/meetings", handler((req) => openMeeting(body(req) as never)));
workRouter.post(
  "/meetings/:id/notes",
  handler((req) => {
    addNote(param(req, "id"), body(req) as never);
    return getMeeting(param(req, "id"));
  }),
);
workRouter.post(
  "/meetings/:id/close",
  handler((req) =>
    closeMeeting(param(req, "id"), String(body(req).summary ?? ""), (body(req).decisions as string[]) ?? []),
  ),
);
