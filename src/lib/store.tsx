import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  clients as seedClients,
  currentUserId,
  members as seedMembers,
  projects as seedProjects,
  timeEntries as seedEntries,
  TODAY,
} from "./mock-data";
import type { Client, Member, Project, TimeEntry, TrelloState } from "./mock-data";
import { addSecondsToTime, nowTime } from "./format";

export type TimerStatus = "idle" | "running" | "paused";

export interface TimerState {
  status: TimerStatus;
  task: string;
  projectId: string;
  billable: boolean;
  startedAt: number | null;
  accumulated: number;
  startClock: string;
}

const initialTimer: TimerState = {
  status: "idle",
  task: "",
  projectId: "p1",
  billable: true,
  startedAt: null,
  accumulated: 0,
  startClock: "09:00",
};

const initialTrello: TrelloState = {
  status: "disconnected",
  workspace: null,
  board: null,
  lists: [],
  cards: [],
  rule: "lists",
  lastSync: null,
};

export interface WorkspaceSettings {
  workspaceName: string;
  defaultBillable: boolean;
  roundingMinutes: string;
  weekStart: string;
  reminders: boolean;
  weeklyDigest: boolean;
  idleDetection: boolean;
}

interface StoreValue {
  entries: TimeEntry[];
  projects: Project[];
  clients: Client[];
  members: Member[];
  timer: TimerState;
  elapsed: number;
  trello: TrelloState;
  settings: WorkspaceSettings;
  currentUserId: string;
  today: string;
  startTimer: (task: string, projectId: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  addEntry: (entry: Omit<TimeEntry, "id">) => void;
  updateEntry: (id: string, patch: Partial<TimeEntry>) => void;
  deleteEntry: (id: string) => void;
  addProject: (project: Omit<Project, "id">) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  addClient: (client: Omit<Client, "id">) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  setTrello: (patch: Partial<TrelloState>) => void;
  setSettings: (patch: Partial<WorkspaceSettings>) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

let idCounter = 100;
const nextId = (prefix: string) => `${prefix}${++idCounter}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<TimeEntry[]>(seedEntries);
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const [clients, setClients] = useState<Client[]>(seedClients);
  const [members] = useState<Member[]>(seedMembers);
  const [timer, setTimer] = useState<TimerState>(initialTimer);
  const [trello, setTrelloState] = useState<TrelloState>(initialTrello);
  const [elapsed, setElapsed] = useState(0);
  const [settings, setSettingsState] = useState<WorkspaceSettings>({
    workspaceName: "Studio Co.",
    defaultBillable: true,
    roundingMinutes: "none",
    weekStart: "monday",
    reminders: true,
    weeklyDigest: false,
    idleDetection: true,
  });

  const timerRef = useRef(timer);
  timerRef.current = timer;

  useEffect(() => {
    if (timer.status !== "running") return;
    const tick = () => {
      const t = timerRef.current;
      const base = t.startedAt ? Math.floor((Date.now() - t.startedAt) / 1000) : 0;
      setElapsed(t.accumulated + base);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timer.status, timer.startedAt]);

  const value = useMemo<StoreValue>(() => {
    const startTimer = (task: string, projectId: string) => {
      setElapsed(0);
      setTimer({
        status: "running",
        task: task || "Untitled task",
        projectId,
        billable: true,
        startedAt: Date.now(),
        accumulated: 0,
        startClock: nowTime(),
      });
    };

    const pauseTimer = () => {
      const t = timerRef.current;
      if (t.status !== "running") return;
      const base = t.startedAt ? Math.floor((Date.now() - t.startedAt) / 1000) : 0;
      const total = t.accumulated + base;
      setElapsed(total);
      setTimer({ ...t, status: "paused", accumulated: total, startedAt: null });
    };

    const resumeTimer = () => {
      const t = timerRef.current;
      if (t.status !== "paused") return;
      setTimer({ ...t, status: "running", startedAt: Date.now() });
    };

    const stopTimer = () => {
      const t = timerRef.current;
      if (t.status === "idle") return;
      const base = t.startedAt ? Math.floor((Date.now() - t.startedAt) / 1000) : 0;
      const total = Math.max(60, t.accumulated + base);
      setEntries((list) => [
        {
          id: nextId("t"),
          date: TODAY,
          start: t.startClock,
          end: addSecondsToTime(t.startClock, total),
          seconds: total,
          userId: currentUserId,
          projectId: t.projectId,
          task: t.task,
          billable: t.billable,
        },
        ...list,
      ]);
      setElapsed(0);
      setTimer(initialTimer);
    };

    return {
      entries,
      projects,
      clients,
      members,
      timer,
      elapsed,
      trello,
      settings,
      currentUserId,
      today: TODAY,
      startTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      addEntry: (entry) => setEntries((list) => [{ ...entry, id: nextId("t") }, ...list]),
      updateEntry: (id, patch) =>
        setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e))),
      deleteEntry: (id) => setEntries((list) => list.filter((e) => e.id !== id)),
      addProject: (project) => setProjects((list) => [{ ...project, id: nextId("p") }, ...list]),
      updateProject: (id, patch) =>
        setProjects((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      addClient: (client) => setClients((list) => [{ ...client, id: nextId("c") }, ...list]),
      updateClient: (id, patch) =>
        setClients((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c))),
      setTrello: (patch) => setTrelloState((s) => ({ ...s, ...patch })),
      setSettings: (patch) => setSettingsState((s) => ({ ...s, ...patch })),
    };
  }, [entries, projects, clients, members, timer, elapsed, trello, settings]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/** Simulates an async read so screens can show loading skeletons. */
export function useSimulatedLoad(delay = 450): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setLoading(false), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  return loading;
}

export function useProjectName(): (id: string) => string {
  const { projects } = useStore();
  return (id: string) => projects.find((p) => p.id === id)?.name ?? "Unknown project";
}
