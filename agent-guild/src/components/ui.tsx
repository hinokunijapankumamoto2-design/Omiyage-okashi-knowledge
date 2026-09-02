import type { ReactNode } from "react";

export function Panel({
  title,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-2.5">
          <h2 className="text-[13px] font-semibold tracking-wide text-ink-050">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="panel px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-ink-050">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  idle: "text-ink-400",
  working: "text-mint",
  meeting: "text-violet",
  break: "text-amber",
  offline: "text-ink-600",
};

export function StatusDot({ status }: { status: string }) {
  return (
    <span className={`${STATUS_TONE[status] ?? "text-ink-400"} ${status === "working" ? "pulse" : ""}`}>●</span>
  );
}

const STAGE_TONE: Record<string, string> = {
  inbox: "#6d7893",
  planning: "#7c9cff",
  aligning: "#a78bfa",
  running: "#4fd1a5",
  review: "#ffc857",
  done: "#4fd1a5",
  blocked: "#ff7a90",
  cancelled: "#6d7893",
};

export function StageChip({ stage, label }: { stage: string; label: string }) {
  return (
    <span className="chip" style={{ color: STAGE_TONE[stage], borderColor: `${STAGE_TONE[stage]}55` }}>
      {label}
    </span>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-[13px] text-ink-400">{text}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</span>
      {children}
    </label>
  );
}
