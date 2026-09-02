import { useEffect, useMemo, useRef, useState } from "react";
import { useGuild } from "../state/store.js";
import { buildFloorPlan } from "../office/layout.js";
import { mountOffice, type OfficeHandle } from "../office/renderer.js";
import { localName } from "../i18n/index.js";
import { StatusDot } from "./ui.js";
import { StaffCard } from "./StaffCard.js";

export function OfficeView() {
  const { departments, staff, t, locale, tasks } = useGuild();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<OfficeHandle | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const packDepartments = useMemo(() => {
    const withStaff = new Set(staff.map((member) => member.departmentId));
    return departments.filter((department) => withStaff.has(department.id));
  }, [departments, staff]);

  const plan = useMemo(() => buildFloorPlan(packDepartments, staff), [packDepartments, staff]);

  useEffect(() => {
    if (!canvasRef.current) return;
    handleRef.current = mountOffice(canvasRef.current, setSelected);
    return () => handleRef.current?.destroy();
  }, []);

  useEffect(() => {
    handleRef.current?.update(staff, plan);
  }, [staff, plan]);

  const busy = staff.filter((member) => member.status === "working");
  const selectedStaff = staff.find((member) => member.id === selected) ?? null;

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_300px] gap-3">
      <div className="panel relative min-h-0 overflow-hidden">
        <canvas ref={canvasRef} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1.5 bg-gradient-to-t from-ink-950/95 to-transparent px-3 pb-2.5 pt-6">
          {packDepartments.map((department) => (
            <span key={department.id} className="chip bg-ink-950/80" style={{ borderColor: `${department.accent}66` }}>
              <span style={{ color: department.accent }}>■</span>
              {localName(locale, department)}
            </span>
          ))}
          <span className="ml-auto text-[11px] text-ink-400">
            {busy.length > 0
              ? `${busy.length} ${t.status.working.toLowerCase()} · ${busy.map((m) => m.displayName).join(", ")}`
              : t.status.idle}
          </span>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-3">
        {selectedStaff ? (
          <StaffCard staff={selectedStaff} onClose={() => setSelected(null)} />
        ) : (
          <div className="panel p-4">
            <h3 className="text-[13px] font-semibold">{t.nav.office}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
              {t.tagline}. {t.staff.title} → {staff.length}.
            </p>
          </div>
        )}

        <div className="panel min-h-0 flex-1 overflow-auto">
          <div className="sticky top-0 border-b border-ink-800 bg-ink-900/95 px-3 py-2 text-[11px] uppercase tracking-wider text-ink-400">
            {t.staff.title}
          </div>
          <ul className="divide-y divide-ink-800/60">
            {staff.map((member) => {
              const task = tasks.find((entry) => entry.id === member.activeTaskId);
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(member.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-ink-850"
                  >
                    <StatusDot status={member.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium">
                        {localName(locale, member)}
                      </span>
                      <span className="block truncate text-[11px] text-ink-400">
                        {task ? task.title : t.status[member.status]}
                      </span>
                    </span>
                    <span
                      className="h-5 w-1 rounded-full"
                      style={{ background: member.departmentAccent ?? "#7c9cff" }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
