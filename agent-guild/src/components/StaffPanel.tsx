import { useEffect, useState } from "react";
import { api, type Skill, type Staff } from "../api/client.js";
import { useGuild } from "../state/store.js";
import { localName } from "../i18n/index.js";
import { Empty, Field, Panel, StatusDot } from "./ui.js";

interface Runner {
  id: string;
  kind: string;
  label: string;
  note: string;
}

export function StaffPanel() {
  const { staff, departments, t, locale, refresh } = useGuild();
  const [runners, setRunners] = useState<Runner[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.get<{ runners: Runner[] }>("/runners").then((r) => setRunners(r.runners));
  }, []);

  const member = staff.find((entry) => entry.id === selected) ?? null;

  async function patch(id: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await api.patch(`/staff/${id}`, payload);
      await refresh(["staff"]);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_360px] gap-3">
      <Panel
        title={`${t.staff.title} (${staff.length})`}
        actions={
          <button type="button" className="btn btn-primary px-2 py-1 text-[11px]" onClick={() => setHiring(true)}>
            + {t.staff.hire}
          </button>
        }
      >
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-ink-900 text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-2 py-2 text-left font-medium">{t.staff.department}</th>
              <th className="px-2 py-2 text-left font-medium">{t.staff.runner}</th>
              <th className="px-2 py-2 text-right font-medium">{t.staff.level}</th>
              <th className="px-4 py-2 text-right font-medium">{t.staff.completed}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/60">
            {staff.map((entry) => {
              const department = departments.find((d) => d.id === entry.departmentId);
              return (
                <tr
                  key={entry.id}
                  onClick={() => setSelected(entry.id)}
                  className={`cursor-pointer hover:bg-ink-850 ${selected === entry.id ? "bg-ink-850" : ""}`}
                >
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <StatusDot status={entry.status} />
                      <span className="truncate">{localName(locale, entry)}</span>
                      <span className="chip">{t.seniority[entry.seniority]}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-ink-400">{department ? localName(locale, department) : "—"}</td>
                  <td className="mono px-2 py-2 text-ink-400">{entry.runnerId}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{entry.level ?? 1}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-mint">{entry.completedTasks}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {staff.length === 0 && <Empty text={t.board.empty} />}
      </Panel>

      <div className="min-h-0 overflow-auto">
        {error && <p className="mb-2 text-[12px] text-rose">{error}</p>}
        {member ? (
          <StaffEditor key={member.id} member={member} runners={runners} onPatch={patch} />
        ) : (
          <div className="panel p-4 text-[12.5px] text-ink-400">{t.staff.title}</div>
        )}
      </div>

      {hiring && <HireDialog runners={runners} onClose={() => setHiring(false)} />}
    </div>
  );
}

function StaffEditor({
  member,
  runners,
  onPatch,
}: {
  member: Staff;
  runners: Runner[];
  onPatch: (id: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const { t, departments, refresh } = useGuild();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [catalog, setCatalog] = useState<Skill[]>([]);

  const loadSkills = () =>
    Promise.all([
      api.get<{ skills: Skill[] }>(`/staff/${member.id}/skills`).then((r) => setSkills(r.skills)),
      api.get<{ skills: Skill[] }>("/skills").then((r) => setCatalog(r.skills)),
    ]);

  useEffect(() => {
    void loadSkills();
  }, [member.id]);

  const learned = new Set(skills.map((skill) => skill.slug));

  return (
    <div className="panel space-y-3 p-4">
      <h3 className="text-[15px] font-semibold">{member.displayName}</h3>

      <Field label={t.staff.department}>
        <select
          className="field"
          value={member.departmentId ?? ""}
          onChange={(event) => onPatch(member.id, { departmentId: event.target.value || null })}
        >
          <option value="">—</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.nameEn} ({department.packKey})
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.staff.runner}>
          <select
            className="field"
            value={member.runnerId}
            onChange={(event) => {
              const runner = runners.find((entry) => entry.id === event.target.value);
              onPatch(member.id, { runnerId: event.target.value, runnerKind: runner?.kind ?? "cli" });
            }}
          >
            {runners.map((runner) => (
              <option key={runner.id} value={runner.id}>
                {runner.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.staff.model}>
          <input
            className="field"
            defaultValue={member.model}
            onBlur={(event) => onPatch(member.id, { model: event.target.value })}
          />
        </Field>
      </div>

      <Field label={t.staff.temperament}>
        <textarea
          className="field h-16 resize-none"
          defaultValue={member.temperament}
          onBlur={(event) => onPatch(member.id, { temperament: event.target.value })}
        />
      </Field>

      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-400">{t.staff.skills}</div>
        <div className="max-h-64 space-y-1 overflow-auto rounded-lg border border-ink-800 p-2">
          {catalog.map((skill) => (
            <label key={skill.id} className="flex items-start gap-2 rounded px-1 py-0.5 hover:bg-ink-850">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={learned.has(skill.slug)}
                onChange={async (event) => {
                  if (event.target.checked) await api.post(`/staff/${member.id}/skills`, { slug: skill.slug });
                  else await api.del(`/staff/${member.id}/skills/${skill.slug}`);
                  await loadSkills();
                }}
              />
              <span className="min-w-0">
                <span className="block text-[12px]">{skill.name}</span>
                <span className="block truncate text-[10.5px] text-ink-400">{skill.summary}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="btn w-full text-rose"
        onClick={async () => {
          await api.del(`/staff/${member.id}`);
          await refresh(["staff", "stats"]);
        }}
      >
        {t.staff.dismiss}
      </button>
    </div>
  );
}

function HireDialog({ runners, onClose }: { runners: Runner[]; onClose: () => void }) {
  const { t, departments, refresh } = useGuild();
  const [displayName, setDisplayName] = useState("");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [seniority, setSeniority] = useState("associate");
  const [runnerId, setRunnerId] = useState("claude-code");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink-950/70 p-4" onClick={onClose}>
      <div className="panel w-full max-w-md space-y-3 p-4" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">{t.staff.hire}</h2>
        <Field label="Name">
          <input className="field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoFocus />
        </Field>
        <Field label={t.staff.department}>
          <select className="field" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.nameEn} ({department.packKey})
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seniority">
            <select className="field" value={seniority} onChange={(event) => setSeniority(event.target.value)}>
              {(["lead", "senior", "associate", "trainee"] as const).map((value) => (
                <option key={value} value={value}>
                  {t.seniority[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.staff.runner}>
            <select className="field" value={runnerId} onChange={(event) => setRunnerId(event.target.value)}>
              {runners.map((runner) => (
                <option key={runner.id} value={runner.id}>
                  {runner.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && <p className="text-[12px] text-rose">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!displayName.trim()}
            onClick={async () => {
              try {
                const runner = runners.find((entry) => entry.id === runnerId);
                await api.post("/staff", {
                  displayName,
                  departmentId,
                  seniority,
                  runnerId,
                  runnerKind: runner?.kind ?? "cli",
                });
                await refresh(["staff", "stats"]);
                onClose();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
              }
            }}
          >
            {t.staff.hire}
          </button>
        </div>
      </div>
    </div>
  );
}
