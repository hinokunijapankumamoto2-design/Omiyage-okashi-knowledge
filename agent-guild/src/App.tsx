import { useState } from "react";
import { useGuild } from "./state/store.js";
import { OfficeView } from "./components/OfficeView.js";
import { Dashboard } from "./components/Dashboard.js";
import { TaskBoard } from "./components/TaskBoard.js";
import { ChatPanel } from "./components/ChatPanel.js";
import { StaffPanel } from "./components/StaffPanel.js";
import { SkillsPanel } from "./components/SkillsPanel.js";
import { ProjectsPanel } from "./components/ProjectsPanel.js";
import { SettingsPanel } from "./components/SettingsPanel.js";

type View = "office" | "board" | "dashboard" | "staff" | "skills" | "projects" | "settings";

const VIEWS: View[] = ["office", "board", "dashboard", "staff", "skills", "projects", "settings"];

export function App() {
  const { t, ready, error, stats } = useGuild();
  const [view, setView] = useState<View>("office");
  const [chatOpen, setChatOpen] = useState(true);

  if (!ready) {
    return <div className="grid h-full place-items-center text-[13px] text-ink-400">{t.common.loading}</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-ink-800 bg-ink-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <GuildMark />
          <div>
            <div className="text-[13px] font-semibold leading-none">{t.appName}</div>
            <div className="text-[10.5px] leading-none text-ink-400">{t.tagline}</div>
          </div>
        </div>

        <nav className="flex flex-1 gap-1">
          {VIEWS.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setView(entry)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition ${
                view === entry ? "bg-ink-800 text-ink-050" : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
              }`}
            >
              {t.nav[entry]}
            </button>
          ))}
        </nav>

        {stats && (
          <div className="flex items-center gap-3 text-[11px] text-ink-400">
            <span>
              <span className="text-mint">●</span> {stats.staff.working}/{stats.staff.total}
            </span>
            <span>{stats.tasks.running ?? 0} {t.stage.running}</span>
          </div>
        )}

        <button type="button" className="btn px-2 py-1 text-[11px]" onClick={() => setChatOpen((value) => !value)}>
          {t.chat.title}
        </button>
      </header>

      {error && (
        <div className="border-b border-rose/40 bg-rose/10 px-4 py-1.5 text-[12px] text-rose">
          {t.common.error}: {error}
        </div>
      )}

      <main className="grid min-h-0 flex-1 gap-3 p-3" style={{ gridTemplateColumns: chatOpen ? "minmax(0,1fr) 340px" : "minmax(0,1fr)" }}>
        <div className="min-h-0">
          {view === "office" && <OfficeView />}
          {view === "board" && <TaskBoard />}
          {view === "dashboard" && <Dashboard />}
          {view === "staff" && <StaffPanel />}
          {view === "skills" && <SkillsPanel />}
          {view === "projects" && <ProjectsPanel />}
          {view === "settings" && <SettingsPanel />}
        </div>
        {chatOpen && (
          <div className="min-h-0">
            <ChatPanel />
          </div>
        )}
      </main>
    </div>
  );
}

/** Inline mark — an office grid with one lit desk. Drawn, not imported. */
function GuildMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="1" y="1" width="24" height="24" rx="6" fill="#161a25" stroke="#262c3e" />
      <rect x="6" y="6" width="6" height="6" rx="1.5" fill="#364054" />
      <rect x="14" y="6" width="6" height="6" rx="1.5" fill="#364054" />
      <rect x="6" y="14" width="6" height="6" rx="1.5" fill="#364054" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" fill="#7c9cff" />
    </svg>
  );
}
