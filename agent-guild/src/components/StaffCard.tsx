import { useEffect, useState } from "react";
import { api, type Skill, type Staff } from "../api/client.js";
import { useGuild } from "../state/store.js";
import { localName } from "../i18n/index.js";
import { StatusDot } from "./ui.js";

export function StaffCard({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const { t, locale, departments } = useGuild();
  const [skills, setSkills] = useState<Skill[]>([]);
  const department = departments.find((entry) => entry.id === staff.departmentId);

  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ skills: Skill[] }>(`/staff/${staff.id}/skills`)
      .then((response) => !cancelled && setSkills(response.skills))
      .catch(() => setSkills([]));
    return () => {
      cancelled = true;
    };
  }, [staff.id]);

  const level = staff.level ?? 1;

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <StatusDot status={staff.status} />
            <h3 className="text-[15px] font-semibold">{localName(locale, staff)}</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {department ? localName(locale, department) : t.common.none} · {t.seniority[staff.seniority]}
          </p>
        </div>
        <button type="button" className="btn px-2 py-1 text-[11px]" onClick={onClose}>
          {t.common.close}
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-ink-950 py-2">
          <dt className="text-[10px] uppercase text-ink-400">{t.staff.level}</dt>
          <dd className="text-[15px] font-semibold tabular-nums">{level}</dd>
        </div>
        <div className="rounded-lg bg-ink-950 py-2">
          <dt className="text-[10px] uppercase text-ink-400">{t.staff.completed}</dt>
          <dd className="text-[15px] font-semibold tabular-nums text-mint">{staff.completedTasks}</dd>
        </div>
        <div className="rounded-lg bg-ink-950 py-2">
          <dt className="text-[10px] uppercase text-ink-400">{t.staff.failed}</dt>
          <dd className="text-[15px] font-semibold tabular-nums text-rose">{staff.failedTasks}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-200">{staff.temperament}</p>

      <div className="mt-3 space-y-1 text-[11px] text-ink-400">
        <div>
          {t.staff.runner}: <span className="mono text-ink-200">{staff.runnerId}</span>
        </div>
        {staff.model && (
          <div>
            {t.staff.model}: <span className="mono text-ink-200">{staff.model}</span>
          </div>
        )}
      </div>

      {skills.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">{t.staff.skills}</div>
          <div className="flex flex-wrap gap-1">
            {skills.map((skill) => (
              <span key={skill.id} className="chip">
                {skill.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
