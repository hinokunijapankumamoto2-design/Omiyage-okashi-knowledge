import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useGuild } from "../state/store.js";
import { LOCALES, type Locale } from "../i18n/index.js";
import { Field, Panel } from "./ui.js";

interface Runner {
  id: string;
  kind: string;
  label: string;
  note: string;
  defaultBaseUrl: string;
  defaultModel: string;
  bin: string;
}

interface Probe {
  id: string;
  label: string;
  bin: string;
  available: boolean;
  version: string;
}

interface Credential {
  id: string;
  label: string;
  runnerId: string;
  baseUrl: string;
  secretHint: string;
  defaultModel: string;
  hasSecret: boolean;
}

export function SettingsPanel() {
  const { t, locale, setLocale, refresh } = useGuild();
  const [runners, setRunners] = useState<Runner[]>([]);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [keyManaged, setKeyManaged] = useState(true);
  const [probing, setProbing] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadCredentials = () =>
    api.get<{ credentials: Credential[] }>("/credentials").then((r) => setCredentials(r.credentials));

  useEffect(() => {
    void api
      .get<{ runners: Runner[]; secretKeyManaged: boolean }>("/runners")
      .then((r) => {
        setRunners(r.runners);
        setKeyManaged(r.secretKeyManaged);
      });
    void loadCredentials();
    void api.get<Record<string, unknown>>("/settings").then(setSettings);
  }, []);

  async function probe(): Promise<void> {
    setProbing(true);
    try {
      const response = await api.get<{ probes: Probe[] }>("/runners/probe");
      setProbes(response.probes);
    } finally {
      setProbing(false);
    }
  }

  async function patchSettings(patch: Record<string, unknown>): Promise<void> {
    setSettings(await api.patch<Record<string, unknown>>("/settings", patch));
    await refresh(["stats"]);
  }

  return (
    <div className="grid h-full min-h-0 gap-3 overflow-auto lg:grid-cols-2">
      <Panel title={t.settings.title}>
        <div className="space-y-4 p-4">
          <Field label={t.settings.language}>
            <select className="field" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              {LOCALES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="border-t border-ink-800 pt-4">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-400">
              {t.settings.engine}
            </h3>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={settings["engine.autoDispatch"] !== false}
                onChange={(event) => patchSettings({ "engine.autoDispatch": event.target.checked })}
              />
              {t.settings.autoDispatch}
            </label>
            <div className="mt-3">
              <Field label={t.settings.reviewRounds}>
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="field w-24"
                  value={Number(settings["engine.reviewRounds"] ?? 2)}
                  onChange={(event) => patchSettings({ "engine.reviewRounds": Number(event.target.value) })}
                />
              </Field>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title={t.settings.runners}
        actions={
          <button type="button" className="btn px-2 py-1 text-[11px]" disabled={probing} onClick={probe}>
            {probing ? t.common.loading : "Probe"}
          </button>
        }
      >
        <ul className="divide-y divide-ink-800/60">
          {runners.map((runner) => {
            const found = probes.find((entry) => entry.id === runner.id);
            return (
              <li key={runner.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium">{runner.label}</span>
                  <span className="chip">{runner.kind}</span>
                  {runner.kind === "cli" && found && (
                    <span className={`chip ${found.available ? "text-mint" : "text-ink-400"}`}>
                      {found.available ? t.settings.installed : t.settings.notInstalled}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-ink-400">{runner.note}</p>
                {found?.version && <p className="mono mt-0.5 text-ink-600">{found.version}</p>}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel
        title={t.settings.credentials}
        className="lg:col-span-2"
        actions={
          <button type="button" className="btn btn-primary px-2 py-1 text-[11px]" onClick={() => setAdding(true)}>
            + {t.settings.addCredential}
          </button>
        }
      >
        {!keyManaged && (
          <p className="mx-4 mt-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[12px] text-amber">
            {t.settings.keyWarning}
          </p>
        )}
        <ul className="divide-y divide-ink-800/60">
          {credentials.length === 0 && <li className="px-4 py-6 text-center text-[12.5px] text-ink-400">—</li>}
          {credentials.map((credential) => (
            <li key={credential.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium">{credential.label}</span>
                  <span className="chip">{credential.runnerId}</span>
                </div>
                <div className="mono truncate text-ink-400">
                  {credential.baseUrl} · {credential.secretHint || "no key"}
                </div>
              </div>
              <button
                type="button"
                className="btn px-2 py-1 text-[11px] text-rose"
                onClick={async () => {
                  await api.del(`/credentials/${credential.id}`);
                  await loadCredentials();
                }}
              >
                {t.common.delete}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {adding && (
        <CredentialDialog
          runners={runners.filter((runner) => runner.kind === "http")}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            await loadCredentials();
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function CredentialDialog({
  runners,
  onClose,
  onSaved,
}: {
  runners: Runner[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useGuild();
  const [runnerId, setRunnerId] = useState(runners[0]?.id ?? "openai-compatible");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState(runners[0]?.defaultBaseUrl ?? "");
  const [secret, setSecret] = useState("");
  const [defaultModel, setDefaultModel] = useState(runners[0]?.defaultModel ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink-950/70 p-4" onClick={onClose}>
      <div className="panel w-full max-w-lg space-y-3 p-4" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">{t.settings.addCredential}</h2>
        <Field label="Provider">
          <select
            className="field"
            value={runnerId}
            onChange={(event) => {
              const runner = runners.find((entry) => entry.id === event.target.value);
              setRunnerId(event.target.value);
              setBaseUrl(runner?.defaultBaseUrl ?? "");
              setDefaultModel(runner?.defaultModel ?? "");
            }}
          >
            {runners.map((runner) => (
              <option key={runner.id} value={runner.id}>
                {runner.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Label">
          <input className="field" value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
        <Field label="Base URL">
          <input className="field mono" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </Field>
        <Field label="API key">
          <input
            className="field mono"
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="stored encrypted; never returned to the browser"
          />
        </Field>
        <Field label="Default model">
          <input className="field mono" value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} />
        </Field>
        {error && <p className="text-[12px] text-rose">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!label.trim()}
            onClick={async () => {
              try {
                await api.post("/credentials", { label, runnerId, baseUrl, secret, defaultModel });
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
