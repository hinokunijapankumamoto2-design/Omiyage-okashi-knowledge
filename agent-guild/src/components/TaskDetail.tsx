import { useCallback, useEffect, useState } from "react";
import { api, type Message, type RunRecord, type Task } from "../api/client.js";
import { stream } from "../api/events.js";
import { useGuild } from "../state/store.js";
import { StageChip } from "./ui.js";

interface Detail {
  task: Task;
  subtasks: Task[];
  runs: RunRecord[];
  reports: Array<{ id: string; title: string; body: string; createdAt: number }>;
  messages: Message[];
}

export function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { t, staff, refresh } = useGuild();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"overview" | "terminal" | "reports">("overview");
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await api.get<Detail>(`/tasks/${taskId}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Terminal output arrives as events rather than by polling the run row.
  useEffect(
    () =>
      stream.on((envelope) => {
        const event = envelope.event as { type: string; taskId?: string; chunk?: string };
        if (event.type === "task.log" && event.taskId === taskId) {
          setLive((current) => (current + (event.chunk ?? "")).slice(-40_000));
        }
        if (event.type === "task.updated" && event.taskId === taskId) void load();
        if (event.type === "task.finished" && event.taskId === taskId) void load();
      }),
    [taskId, load],
  );

  async function act(path: string, payload?: unknown): Promise<void> {
    setBusy(true);
    try {
      await api.post(path, payload);
      await load();
      await refresh(["tasks", "stats"]);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <div className="fixed inset-0 z-30 grid place-items-center bg-ink-950/70" onClick={onClose}>
        <div className="panel px-6 py-4 text-[13px] text-ink-400">{error ?? t.common.loading}</div>
      </div>
    );
  }

  const { task } = detail;
  const assignee = staff.find((member) => member.id === task.assigneeId);
  const lastRun = detail.runs[detail.runs.length - 1];

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-ink-950/70" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-ink-800 bg-ink-900"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-ink-800 px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StageChip stage={task.stage} label={t.stage[task.stage]} />
              <span className="mono text-ink-400">{task.id}</span>
            </div>
            <h2 className="mt-1 truncate text-[16px] font-semibold">{task.title}</h2>
          </div>
          <button type="button" className="btn px-2 py-1 text-[11px]" onClick={onClose}>
            {t.common.close}
          </button>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-ink-800 px-5 py-2">
          <button type="button" className="btn" disabled={busy} onClick={() => act(`/tasks/${task.id}/run`, { mode: "plan" })}>
            {t.board.plan}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(`/tasks/${task.id}/run`, { mode: "work" })}>
            {t.board.run}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => act(`/tasks/${task.id}/run`, { mode: "review" })}>
            {t.board.review}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => act(`/tasks/${task.id}/stop`)}>
            {t.board.stop}
          </button>
          {task.branch && (
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => act(`/tasks/${task.id}/merge`)}>
                {t.board.merge}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => act(`/tasks/${task.id}/discard`)}>
                {t.board.discard}
              </button>
            </>
          )}
        </div>

        {error && <div className="border-b border-ink-800 px-5 py-2 text-[12px] text-rose">{error}</div>}

        <nav className="flex gap-1 border-b border-ink-800 px-5">
          {(["overview", "terminal", "reports"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`border-b-2 px-3 py-2 text-[12px] font-medium capitalize transition ${
                tab === key ? "border-accent text-ink-050" : "border-transparent text-ink-400 hover:text-ink-200"
              }`}
            >
              {key}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {tab === "overview" && (
            <div className="space-y-4 text-[13px]">
              <Section label={t.common.brief}>{task.brief || "—"}</Section>
              <Section label={t.common.acceptance}>{task.acceptance || "—"}</Section>
              {task.resultSummary && <Section label="Result">{task.resultSummary}</Section>}
              {task.failureReason && (
                <Section label="Blocker">
                  <span className="text-rose">{task.failureReason}</span>
                </Section>
              )}
              <dl className="grid grid-cols-2 gap-3 text-[12px]">
                <Meta label={t.common.assignee} value={assignee?.displayName ?? "—"} />
                <Meta label="Review round" value={String(task.reviewRound)} />
                <Meta label="Branch" value={task.branch || "—"} mono />
                <Meta label="Workspace" value={task.workspacePath || "—"} mono />
              </dl>
              {detail.subtasks.length > 0 && (
                <Section label="Subtasks">
                  <ul className="space-y-1">
                    {detail.subtasks.map((subtask) => (
                      <li key={subtask.id} className="flex items-center gap-2">
                        <StageChip stage={subtask.stage} label={t.stage[subtask.stage]} />
                        <span className="truncate">{subtask.title}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          )}

          {tab === "terminal" && (
            <pre className="mono whitespace-pre-wrap break-words rounded-lg bg-ink-950 p-3 leading-relaxed text-ink-200">
              {live || lastRun?.outputTail || "—"}
            </pre>
          )}

          {tab === "reports" && (
            <div className="space-y-3">
              {detail.reports.length === 0 && <p className="text-[13px] text-ink-400">—</p>}
              {detail.reports.map((report) => (
                <details key={report.id} className="rounded-lg border border-ink-800 bg-ink-850 p-3">
                  <summary className="cursor-pointer text-[12.5px] font-medium">{report.title}</summary>
                  <pre className="mono mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-ink-200">
                    {report.body}
                  </pre>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className="whitespace-pre-wrap leading-relaxed text-ink-050">{children}</div>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-ink-950 px-3 py-2">
      <dt className="text-[10.5px] uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className={`mt-0.5 truncate ${mono ? "mono" : ""}`}>{value}</dd>
    </div>
  );
}
