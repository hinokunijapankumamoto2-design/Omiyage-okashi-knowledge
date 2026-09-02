import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type Department, type Message, type Pack, type Project, type Staff, type Stats, type Task } from "../api/client.js";
import { stream, type GuildEnvelope } from "../api/events.js";
import { detectLocale, dictionary, type Dictionary, type Locale } from "../i18n/index.js";

interface GuildState {
  ready: boolean;
  error: string | null;
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
  departments: Department[];
  staff: Staff[];
  tasks: Task[];
  projects: Project[];
  packs: Pack[];
  stats: Stats | null;
  messages: Message[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  refresh: (what?: RefreshKey[]) => Promise<void>;
  send: (body: string) => Promise<void>;
}

type RefreshKey = "departments" | "staff" | "tasks" | "projects" | "stats" | "messages" | "packs";

const Context = createContext<GuildState | null>(null);

const ALL: RefreshKey[] = ["departments", "staff", "tasks", "projects", "stats", "messages", "packs"];

export function GuildProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<Locale>(detectLocale);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const refresh = useCallback(
    async (what: RefreshKey[] = ALL) => {
      const jobs: Array<Promise<void>> = [];
      const wanted = new Set(what);
      if (wanted.has("departments"))
        jobs.push(api.get<{ departments: Department[] }>("/departments").then((r) => setDepartments(r.departments)));
      if (wanted.has("staff")) jobs.push(api.get<{ staff: Staff[] }>("/staff").then((r) => setStaff(r.staff)));
      if (wanted.has("tasks"))
        jobs.push(api.get<{ tasks: Task[] }>("/tasks").then((r) => setTasks(r.tasks)));
      if (wanted.has("projects"))
        jobs.push(api.get<{ projects: Project[] }>("/projects").then((r) => setProjects(r.projects)));
      if (wanted.has("packs")) jobs.push(api.get<{ packs: Pack[] }>("/packs").then((r) => setPacks(r.packs)));
      if (wanted.has("stats")) jobs.push(api.get<Stats>("/stats").then(setStats));
      if (wanted.has("messages"))
        jobs.push(api.get<{ messages: Message[] }>("/messages?channel=lobby").then((r) => setMessages(r.messages)));
      try {
        await Promise.all(jobs);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [],
  );

  useEffect(() => {
    void refresh().finally(() => setReady(true));
  }, [refresh]);

  // Realtime events are coalesced: a burst of task logs triggers one refetch.
  const pending = useRef(new Set<RefreshKey>());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    stream.connect();
    const schedule = (keys: RefreshKey[]) => {
      keys.forEach((key) => pending.current.add(key));
      if (timer.current !== null) return;
      timer.current = window.setTimeout(() => {
        const batch = [...pending.current];
        pending.current.clear();
        timer.current = null;
        void refresh(batch);
      }, 250);
    };

    return stream.on((envelope: GuildEnvelope) => {
      const type = envelope.event.type;
      if (type.startsWith("task.")) schedule(["tasks", "stats"]);
      else if (type.startsWith("staff.")) schedule(["staff", "stats"]);
      else if (type.startsWith("department.")) schedule(["departments"]);
      else if (type.startsWith("project.")) schedule(["projects"]);
      else if (type.startsWith("message.")) schedule(["messages"]);
      else if (type.startsWith("skill.")) schedule(["staff"]);
    });
  }, [refresh]);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem("ag.locale", next);
    setLocaleState(next);
  }, []);

  const send = useCallback(
    async (body: string) => {
      await api.post("/messages", { body, channel: "lobby" });
      await refresh(["messages", "tasks", "stats"]);
    },
    [refresh],
  );

  const value = useMemo<GuildState>(
    () => ({
      ready,
      error,
      locale,
      t: dictionary(locale),
      setLocale,
      departments,
      staff,
      tasks,
      projects,
      packs,
      stats,
      messages,
      activeProjectId,
      setActiveProjectId,
      refresh,
      send,
    }),
    [ready, error, locale, setLocale, departments, staff, tasks, projects, packs, stats, messages, activeProjectId, refresh, send],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useGuild(): GuildState {
  const value = useContext(Context);
  if (!value) throw new Error("useGuild must be used inside <GuildProvider>");
  return value;
}
