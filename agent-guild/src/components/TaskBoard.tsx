import { useMemo, useState } from "react";
import { api, type Stage, type Task } from "../api/client.js";
import { useGuild } from "../state/store.js";
import { Empty, Field, StageChip } from "./ui.js";
import { TaskDetail } from "./TaskDetail.js";

const COLUMNS: Stage[] = ["inbox", "planning", "aligning", "running", "review", "done", "blocked"];

export function TaskBoard() {
  const { tasks, t, departments, projects, activeProjectId, setActiveProjectId, refresh, staff } = useGuild();
  const [open, setOpen] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => tasks.filter((task) => !task.parentTaskId && (!activeProjectId || task.projectId === activeProjectId)),
    [tasks, activeProjectId],
  );

  const columns = useMemo(() => {
    const grouped = Object.fromEntries(COLUMNS.map((stage) => [stage, [] as Task[]])) as Record<Stage, Task[]>;
    for (const task of visible) if (grouped[task.stage]) grouped[task.stage].push(task);
    return grouped;
  }, [visible]);

  async function move(taskId: string, stage: Stage): Promise<void> {
    try {
      await api.patch(`/tasks/${taskId}`, { stage });
      setError(null);
      await refresh(["tasks", "stats"]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="field w-56"
          value={activeProjectId ?? ""}
          onChange={(event) => setActiveProjectId(event.target.value || null)}
        >
          <option value="">{t.board.allProjects}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" onClick={() => setComposing(true)}>
          + {t.board.newTask}
        </button>
        {error && <span className="text-[12px] text-rose">{error}</span>}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(190px, 1fr))` }}>
        {COLUMNS.map((stage) => (
          <div
            key={stage}
            className="panel flex min-h-0 flex-col"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragging) void move(dragging, stage);
              setDragging(null);
            }}
          >
            <header className="flex items-center justify-between border-b border-ink-800 px-3 py-2">
              <StageChip stage={stage} label={t.stage[stage]} />
              <span className="text-[11px] tabular-nums text-ink-400">{columns[stage].length}</span>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
              {columns[stage].length === 0 && <Empty text={t.board.empty} />}
              {columns[stage].map((task) => {
                const department = departments.find((entry) => entry.id === task.departmentId);
                const assignee = staff.find((entry) => entry.id === task.assigneeId);
                return (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={() => setDragging(task.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => setOpen(task.id)}
                    className="cursor-pointer rounded-xl border border-ink-800 bg-ink-850 p-2.5 transition hover:border-ink-600"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: department?.accent ?? "#6d7893" }}
                      />
                      <h3 className="text-[12.5px] font-medium leading-snug">{task.title}</h3>
                    </div>
                    {task.brief && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-400">{task.brief}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-ink-400">
                      <span className="truncate">{assignee?.displayName ?? "—"}</span>
                      {task.reviewRound > 0 && <span className="chip">R{task.reviewRound}</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {composing && <ComposeTask onClose={() => setComposing(false)} />}
      {open && <TaskDetail taskId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ComposeTask({ onClose }: { onClose: () => void }) {
  const { t, departments, projects, activeProjectId, refresh } = useGuild();
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [priority, setPriority] = useState(2);
  const [departmentId, setDepartmentId] = useState("");
  const [projectId, setProjectId] = useState(activeProjectId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    try {
      await api.post("/tasks", {
        title,
        brief,
        acceptance,
        priority,
        departmentId: departmentId || null,
        projectId: projectId || null,
        stage: "planning",
      });
      await refresh(["tasks", "stats"]);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink-950/70 p-4" onClick={onClose}>
      <div className="panel w-full max-w-lg p-4" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">{t.board.newTask}</h2>
        <div className="mt-3 space-y-3">
          <Field label={t.common.title}>
            <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          </Field>
          <Field label={t.common.brief}>
            <textarea className="field h-20 resize-none" value={brief} onChange={(event) => setBrief(event.target.value)} />
          </Field>
          <Field label={t.common.acceptance}>
            <textarea
              className="field h-16 resize-none"
              value={acceptance}
              onChange={(event) => setAcceptance(event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t.staff.department}>
              <select className="field" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                <option value="">—</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.nameEn}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.projects.title}>
              <select className="field" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">—</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.common.priority}>
              <select className="field" value={priority} onChange={(event) => setPriority(Number(event.target.value))}>
                {[0, 1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    P{value}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        {error && <p className="mt-2 text-[12px] text-rose">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="button" className="btn btn-primary" disabled={!title.trim() || busy} onClick={submit}>
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
