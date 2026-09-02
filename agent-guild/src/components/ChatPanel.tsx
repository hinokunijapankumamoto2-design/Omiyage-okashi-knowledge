import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useGuild } from "../state/store.js";

interface DirectiveHelp {
  verb: string;
  usage: string;
  description: string;
}

export function ChatPanel() {
  const { messages, send, t, staff } = useGuild();
  const [draft, setDraft] = useState("");
  const [help, setHelp] = useState<DirectiveHelp[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.get<{ directives: DirectiveHelp[] }>("/directives").then((r) => setHelp(r.directives));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const suggestions = draft.startsWith("$")
    ? help.filter((entry) => entry.verb.startsWith(draft.slice(1).split(" ")[0]))
    : [];

  async function submit(): Promise<void> {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await send(body);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-ink-800 px-4 py-2.5">
        <h2 className="text-[13px] font-semibold">{t.chat.title}</h2>
        <button type="button" className="btn px-2 py-1 text-[11px]" onClick={() => setShowHelp((value) => !value)}>
          {t.chat.directives}
        </button>
      </header>

      {showHelp && (
        <div className="max-h-52 overflow-auto border-b border-ink-800 bg-ink-950 px-4 py-2">
          {help.map((entry) => (
            <button
              key={entry.verb}
              type="button"
              className="block w-full py-1 text-left"
              onClick={() => {
                setDraft(`$${entry.verb} `);
                setShowHelp(false);
              }}
            >
              <span className="mono text-accent">{entry.usage}</span>
              <span className="ml-2 text-[11px] text-ink-400">{entry.description}</span>
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-auto px-4 py-3">
        {messages.map((message) => {
          const author =
            message.authorKind === "ceo"
              ? "CEO"
              : message.authorKind === "system"
                ? "system"
                : (message.authorName ??
                  staff.find((member) => member.id === message.authorId)?.displayName ??
                  "agent");
          const tone =
            message.authorKind === "ceo"
              ? "border-accent/40 bg-accent/10"
              : message.authorKind === "system"
                ? "border-ink-700 bg-ink-950"
                : "border-ink-800 bg-ink-850";
          return (
            <div key={message.id} className={`rounded-xl border px-3 py-2 ${tone}`}>
              <div className="mb-0.5 flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold text-ink-200">{author}</span>
                <span className="text-[10px] text-ink-400">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className={`whitespace-pre-wrap text-[12.5px] leading-relaxed ${message.directive ? "mono text-accent" : ""}`}>
                {message.body}
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {suggestions.length > 0 && (
        <div className="border-t border-ink-800 bg-ink-950 px-4 py-1.5">
          {suggestions.slice(0, 3).map((entry) => (
            <div key={entry.verb} className="mono text-[11px] text-ink-400">
              {entry.usage}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-t border-ink-800 p-3">
        <textarea
          className="field h-16 resize-none"
          placeholder={t.chat.placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
          }}
        />
        <button type="button" className="btn btn-primary self-end" disabled={busy || !draft.trim()} onClick={submit}>
          {t.chat.send}
        </button>
      </div>
    </div>
  );
}
