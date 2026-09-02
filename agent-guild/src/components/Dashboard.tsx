import { useGuild } from "../state/store.js";
import { Empty, Panel, Stat } from "./ui.js";

export function Dashboard() {
  const { stats, t, tasks } = useGuild();
  if (!stats) return <Empty text={t.common.loading} />;

  const stageOrder = ["inbox", "planning", "aligning", "running", "review", "done", "blocked"] as const;
  const maxDepartment = Math.max(1, ...stats.departments.map((entry) => entry.open + entry.done));
  const recent = [...tasks].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 overflow-auto">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.dashboard.headcount} value={stats.staff.total} hint={`${stats.staff.idle} ${t.status.idle}`} />
        <Stat label={t.dashboard.working} value={stats.staff.working} />
        <Stat label={t.dashboard.completedToday} value={stats.throughput.completedToday} hint={`7d: ${stats.throughput.completed7d}`} />
        <Stat label={t.dashboard.meanRun} value={`${stats.meanRunSeconds}s`} />
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-3">
        <Panel title={t.dashboard.departments} className="lg:col-span-2">
          <ul className="space-y-2 p-4">
            {stats.departments.map((department) => {
              const total = department.open + department.done;
              return (
                <li key={department.code}>
                  <div className="mb-1 flex items-baseline justify-between text-[12px]">
                    <span className="font-medium">{department.nameEn}</span>
                    <span className="tabular-nums text-ink-400">
                      {department.open} {t.dashboard.open} · {department.done} {t.dashboard.done} ·{" "}
                      {department.headcount} 👥
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-850">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(total / maxDepartment) * 100}%`, background: department.accent }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-ink-800 p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-400">{t.board.title}</div>
            <div className="flex flex-wrap gap-2">
              {stageOrder.map((stage) => (
                <div key={stage} className="rounded-lg border border-ink-800 bg-ink-850 px-3 py-1.5">
                  <div className="text-[10.5px] uppercase text-ink-400">{t.stage[stage]}</div>
                  <div className="text-[15px] font-semibold tabular-nums">{stats.tasks[stage] ?? 0}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <div className="grid min-h-0 grid-rows-2 gap-3">
          <Panel title={t.dashboard.leaderboard}>
            <ol className="divide-y divide-ink-800/60">
              {stats.leaderboard.map((entry, index) => (
                <li key={entry.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-5 text-[12px] tabular-nums text-ink-400">{index + 1}</span>
                  <span className="flex-1 truncate text-[12.5px]">{entry.displayName}</span>
                  <span className="chip">Lv{entry.level}</span>
                  <span className="w-10 text-right text-[11px] tabular-nums text-ink-400">{entry.xp}xp</span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Recent activity">
            {recent.length === 0 ? (
              <Empty text={t.board.empty} />
            ) : (
              <ul className="divide-y divide-ink-800/60">
                {recent.map((task) => (
                  <li key={task.id} className="px-4 py-2">
                    <div className="truncate text-[12.5px]">{task.title}</div>
                    <div className="text-[11px] text-ink-400">
                      {t.stage[task.stage]} · {new Date(task.updatedAt).toLocaleTimeString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
