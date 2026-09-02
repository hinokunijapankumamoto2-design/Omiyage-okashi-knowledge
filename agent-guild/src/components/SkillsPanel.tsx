import { useEffect, useMemo, useState } from "react";
import { api, type Skill } from "../api/client.js";
import { useGuild } from "../state/store.js";
import { Empty, Field, Panel } from "./ui.js";

export function SkillsPanel() {
  const { t } = useGuild();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [category, setCategory] = useState<string>("");
  const [selected, setSelected] = useState<Skill | null>(null);
  const [composing, setComposing] = useState(false);

  const load = () => api.get<{ skills: Skill[] }>("/skills").then((r) => setSkills(r.skills));

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(
    () => [...new Set(skills.map((skill) => skill.category))].sort(),
    [skills],
  );
  const visible = category ? skills.filter((skill) => skill.category === category) : skills;

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)_360px] gap-3">
      <Panel title={t.skills.title}>
        <ul className="p-2">
          <li>
            <button
              type="button"
              onClick={() => setCategory("")}
              className={`w-full rounded-lg px-3 py-1.5 text-left text-[12.5px] ${!category ? "bg-ink-800" : "hover:bg-ink-850"}`}
            >
              {t.skills.all} <span className="text-ink-400">({skills.length})</span>
            </button>
          </li>
          {categories.map((entry) => (
            <li key={entry}>
              <button
                type="button"
                onClick={() => setCategory(entry)}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-[12.5px] capitalize ${
                  category === entry ? "bg-ink-800" : "hover:bg-ink-850"
                }`}
              >
                {entry}{" "}
                <span className="text-ink-400">({skills.filter((skill) => skill.category === entry).length})</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={category || t.skills.all}
        actions={
          <button type="button" className="btn btn-primary px-2 py-1 text-[11px]" onClick={() => setComposing(true)}>
            + {t.skills.custom}
          </button>
        }
      >
        {visible.length === 0 ? (
          <Empty text={t.board.empty} />
        ) : (
          <ul className="divide-y divide-ink-800/60">
            {visible.map((skill) => (
              <li key={skill.id}>
                <button
                  type="button"
                  onClick={() => setSelected(skill)}
                  className="w-full px-4 py-2.5 text-left hover:bg-ink-850"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{skill.name}</span>
                    <span className="chip">{skill.origin === "builtin" ? t.skills.builtin : "custom"}</span>
                    <span className="ml-auto text-[11px] text-ink-400">
                      {skill.learners} {t.skills.learners}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-ink-400">{skill.summary}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={selected?.name ?? "—"}>
        {selected ? (
          <div className="space-y-3 p-4">
            <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-200">{selected.body}</pre>
            {selected.origin === "custom" && (
              <button
                type="button"
                className="btn w-full text-rose"
                onClick={async () => {
                  await api.del(`/skills/${selected.slug}`);
                  setSelected(null);
                  await load();
                }}
              >
                {t.common.delete}
              </button>
            )}
          </div>
        ) : (
          <Empty text={t.skills.title} />
        )}
      </Panel>

      {composing && (
        <CustomSkillDialog
          onClose={() => setComposing(false)}
          onSaved={async () => {
            await load();
            setComposing(false);
          }}
        />
      )}
    </div>
  );
}

function CustomSkillDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useGuild();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function importFile(file: File): Promise<void> {
    const text = await file.text();
    setBody(text);
    if (!name) setName(file.name.replace(/\.md$/i, ""));
    if (!slug) setSlug(file.name.replace(/\.md$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink-950/70 p-4" onClick={onClose}>
      <div className="panel w-full max-w-xl space-y-3 p-4" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">{t.skills.custom}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Slug">
            <input className="field mono" value={slug} onChange={(event) => setSlug(event.target.value)} />
          </Field>
          <Field label="Name">
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        </div>
        <Field label="Summary">
          <input className="field" value={summary} onChange={(event) => setSummary(event.target.value)} />
        </Field>
        <Field label="Body (Markdown)">
          <textarea className="field h-48 resize-none font-mono text-[12px]" value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
        <input
          type="file"
          accept=".md,text/markdown"
          className="text-[12px] text-ink-400"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
        {error && <p className="text-[12px] text-rose">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!slug || !name || !body}
            onClick={async () => {
              try {
                await api.post("/skills", { slug, name, summary, body, category: "custom" });
                await onSaved();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
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
