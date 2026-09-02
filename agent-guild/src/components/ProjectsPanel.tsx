import { useState } from "react";
import { api } from "../api/client.js";
import { useGuild } from "../state/store.js";
import { Empty, Field, Panel } from "./ui.js";

export function ProjectsPanel() {
  const { projects, packs, staff, t, refresh } = useGuild();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const project = projects.find((entry) => entry.id === selected) ?? null;

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_380px] gap-3">
      <Panel
        title={`${t.projects.title} (${projects.length})`}
        actions={
          <button type="button" className="btn btn-primary px-2 py-1 text-[11px]" onClick={() => setAdding(true)}>
            + {t.projects.add}
          </button>
        }
      >
        {projects.length === 0 ? (
          <Empty text={t.board.empty} />
        ) : (
          <ul className="divide-y divide-ink-800/60">
            {projects.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setSelected(entry.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-ink-850 ${selected === entry.id ? "bg-ink-850" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{entry.name}</span>
                    <span className="chip">{entry.packKey}</span>
                    <span className="chip">{entry.vcs === "git" ? entry.isolation : "no vcs"}</span>
                  </div>
                  <div className="mono mt-0.5 truncate text-ink-400">{entry.rootPath}</div>
                  {entry.objective && <p className="mt-1 text-[11.5px] text-ink-400">{entry.objective}</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="min-h-0 overflow-auto">
        {error && <p className="mb-2 text-[12px] text-rose">{error}</p>}
        {project ? (
          <div className="panel space-y-3 p-4">
            <h3 className="text-[15px] font-semibold">{project.name}</h3>
            <Field label={t.projects.objective}>
              <textarea
                className="field h-20 resize-none"
                defaultValue={project.objective}
                onBlur={async (event) => {
                  await api.patch(`/projects/${project.id}`, { objective: event.target.value });
                  await refresh(["projects"]);
                }}
              />
            </Field>
            <Field label={t.projects.isolation}>
              <select
                className="field"
                value={project.isolation}
                onChange={async (event) => {
                  await api.patch(`/projects/${project.id}`, { isolation: event.target.value });
                  await refresh(["projects"]);
                }}
              >
                <option value="worktree">worktree (isolated branch per task)</option>
                <option value="inplace">inplace (agents edit the checkout directly)</option>
              </select>
            </Field>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-400">{t.projects.members}</div>
              <div className="max-h-64 space-y-1 overflow-auto rounded-lg border border-ink-800 p-2">
                {staff.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-ink-850">
                    <input
                      type="checkbox"
                      checked={project.members.includes(member.id)}
                      onChange={async (event) => {
                        const members = event.target.checked
                          ? [...project.members, member.id]
                          : project.members.filter((id) => id !== member.id);
                        await api.patch(`/projects/${project.id}`, { members });
                        await refresh(["projects"]);
                      }}
                    />
                    <span className="text-[12px]">{member.displayName}</span>
                    <span className="ml-auto text-[10.5px] text-ink-400">{member.departmentCode}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-ink-400">
                Leaving this empty lets the dispatcher pick from the whole roster.
              </p>
            </div>
            <button
              type="button"
              className="btn w-full text-rose"
              onClick={async () => {
                await api.del(`/projects/${project.id}`);
                setSelected(null);
                await refresh(["projects", "tasks"]);
              }}
            >
              {t.common.delete}
            </button>
          </div>
        ) : (
          <div className="panel p-4 text-[12.5px] text-ink-400">{t.projects.title}</div>
        )}
      </div>

      {adding && (
        <AddProject
          packs={packs.map((pack) => pack.key)}
          onClose={() => setAdding(false)}
          onError={setError}
        />
      )}
    </div>
  );
}

function AddProject({
  packs,
  onClose,
  onError,
}: {
  packs: string[];
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const { t, refresh } = useGuild();
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [objective, setObjective] = useState("");
  const [packKey, setPackKey] = useState(packs[0] ?? "software");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink-950/70 p-4" onClick={onClose}>
      <div className="panel w-full max-w-lg space-y-3 p-4" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">{t.projects.add}</h2>
        <Field label="Name">
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </Field>
        <Field label={t.projects.path}>
          <input
            className="field mono"
            placeholder="/home/you/code/my-app"
            value={rootPath}
            onChange={(event) => setRootPath(event.target.value)}
          />
        </Field>
        <Field label={t.projects.objective}>
          <textarea className="field h-20 resize-none" value={objective} onChange={(event) => setObjective(event.target.value)} />
        </Field>
        <Field label={t.projects.pack}>
          <select className="field" value={packKey} onChange={(event) => setPackKey(event.target.value)}>
            {packs.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </Field>
        {error && <p className="text-[12px] text-rose">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!name.trim() || !rootPath.trim()}
            onClick={async () => {
              try {
                await api.post("/projects", { name, rootPath, objective, packKey });
                await refresh(["projects"]);
                onClose();
              } catch (cause) {
                const message = cause instanceof Error ? cause.message : String(cause);
                setError(message);
                onError(message);
              }
            }}
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
