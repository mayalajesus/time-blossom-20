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
import {
  addSecondsToDateTime,
  getElapsedMinutes,
  getEndDateForEntry,
  isValidDateOnly,
  nowTime,
} from "./format";

export type TimerStatus = "idle" | "running" | "paused";

export interface TimerState {
  status: TimerStatus;
  task: string;
  projectId: string | null;
  billable: boolean;
  startedAt: number | null;
  startedDate: string | null;
  accumulated: number;
  startClock: string;
}

const initialTimer: TimerState = {
  status: "idle",
  task: "",
  projectId: null,
  billable: true,
  startedAt: null,
  startedDate: null,
  accumulated: 0,
  startClock: "09:00",
};

const TIMER_STORAGE_KEY = `time-blossom:active-timer:v1:${currentUserId}`;

function isValidClock(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidTimerSnapshot(value: unknown): value is TimerState {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<TimerState>;
  if (snapshot.status !== "running" && snapshot.status !== "paused") return false;
  if (typeof snapshot.task !== "string" || !snapshot.task.trim()) return false;
  if (snapshot.projectId !== null && typeof snapshot.projectId !== "string") return false;
  if (
    snapshot.projectId !== null &&
    !seedProjects.some((project) => project.id === snapshot.projectId)
  ) {
    return false;
  }
  if (typeof snapshot.billable !== "boolean") return false;
  if (!isValidClock(snapshot.startClock)) return false;
  if (typeof snapshot.startedDate !== "string" || !isValidDateOnly(snapshot.startedDate)) {
    return false;
  }
  if (typeof snapshot.accumulated !== "number" || !Number.isFinite(snapshot.accumulated)) {
    return false;
  }
  if (snapshot.accumulated < 0) return false;
  if (snapshot.status === "running") {
    if (typeof snapshot.startedAt !== "number" || !Number.isFinite(snapshot.startedAt)) {
      return false;
    }
    if (snapshot.startedAt > Date.now() + 60_000) return false;
  } else if (snapshot.startedAt !== null) {
    return false;
  }
  return true;
}

function readPersistedTimer(): TimerState {
  if (typeof window === "undefined") return initialTimer;

  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return initialTimer;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidTimerSnapshot(parsed)) {
      window.localStorage.removeItem(TIMER_STORAGE_KEY);
      return initialTimer;
    }
    return parsed;
  } catch {
    try {
      window.localStorage.removeItem(TIMER_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
    return initialTimer;
  }
}

function elapsedForTimer(timer: TimerState, now = Date.now()): number {
  if (timer.status !== "running" || timer.startedAt === null) {
    return timer.accumulated;
  }
  return Math.max(0, timer.accumulated + Math.floor((now - timer.startedAt) / 1000));
}

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

export type StoreResult = { success: true } | { success: false; error: string };

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
  startTimer: (task: string, projectId: string | null) => StoreResult;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  addEntry: (entry: Omit<TimeEntry, "id">) => StoreResult;
  updateEntry: (id: string, patch: Partial<Omit<TimeEntry, "id">>) => StoreResult;
  deleteEntry: (id: string) => void;
  addProject: (project: Omit<Project, "id">) => StoreResult;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => StoreResult;
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
  const [timer, setTimer] = useState<TimerState>(() => readPersistedTimer());
  const [trello, setTrelloState] = useState<TrelloState>(initialTrello);
  const [elapsed, setElapsed] = useState(() => elapsedForTimer(timer));
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
    try {
      if (timer.status === "idle") {
        window.localStorage.removeItem(TIMER_STORAGE_KEY);
      } else {
        window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
      }
    } catch {
      // The timer remains usable when browser storage is unavailable.
    }
  }, [timer]);

  useEffect(() => {
    const refreshElapsed = () => setElapsed(elapsedForTimer(timerRef.current));
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") refreshElapsed();
    };

    refreshElapsed();
    window.addEventListener("focus", refreshElapsed);
    document.addEventListener("visibilitychange", refreshWhenActive);

    if (timer.status !== "running") {
      return () => {
        window.removeEventListener("focus", refreshElapsed);
        document.removeEventListener("visibilitychange", refreshWhenActive);
      };
    }

    const id = window.setInterval(refreshElapsed, 1000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refreshElapsed);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [timer.status, timer.startedAt, timer.accumulated]);

  const value = useMemo<StoreValue>(() => {
    const validateProjectId = (projectId: string | null): StoreResult => {
      if (projectId === null) return { success: true };
      if (projects.some((project) => project.id === projectId)) return { success: true };
      return { success: false, error: "Choose an existing project or No project." };
    };

    const validateEntry = (entry: Omit<TimeEntry, "id">): StoreResult => {
      const projectValidation = validateProjectId(entry.projectId);
      if (!projectValidation.success) return projectValidation;
      if (!entry.task.trim()) return { success: false, error: "A task is required." };
      if (!isValidDateOnly(entry.date)) return { success: false, error: "Choose a valid date." };
      if (entry.endDate && !isValidDateOnly(entry.endDate)) {
        return { success: false, error: "Choose a valid end date." };
      }
      if (entry.endDate && entry.endDate < entry.date) {
        return { success: false, error: "End date cannot be before the start date." };
      }
      const endDate = getEndDateForEntry(entry);
      const elapsedMinutes = getElapsedMinutes(entry.date, entry.start, endDate, entry.end);
      if (elapsedMinutes <= 0 || entry.seconds <= 0) {
        return { success: false, error: "End time must be after start time." };
      }
      return { success: true };
    };

    const startTimer = (task: string, projectId: string | null): StoreResult => {
      const projectValidation = validateProjectId(projectId);
      if (!projectValidation.success) return projectValidation;
      setElapsed(0);
      setTimer({
        status: "running",
        task: task || "Untitled task",
        projectId,
        billable: true,
        startedAt: Date.now(),
        startedDate: TODAY,
        accumulated: 0,
        startClock: nowTime(),
      });
      return { success: true };
    };

    const pauseTimer = () => {
      const t = timerRef.current;
      if (t.status !== "running") return;
      const total = elapsedForTimer(t);
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
      const total = Math.max(60, elapsedForTimer(t));
      const startedDate = t.startedDate ?? TODAY;
      const finish = addSecondsToDateTime(startedDate, t.startClock, total);
      setEntries((list) => [
        {
          id: nextId("t"),
          date: startedDate,
          start: t.startClock,
          end: finish.end,
          ...(finish.endDate !== startedDate ? { endDate: finish.endDate } : {}),
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

    const addEntry = (entry: Omit<TimeEntry, "id">): StoreResult => {
      const validation = validateEntry(entry);
      if (!validation.success) return validation;
      setEntries((list) => [{ ...entry, id: nextId("t") }, ...list]);
      return { success: true };
    };

    const updateEntry = (id: string, patch: Partial<Omit<TimeEntry, "id">>): StoreResult => {
      const current = entries.find((entry) => entry.id === id);
      if (!current) return { success: false, error: "This time entry no longer exists." };
      const next = { ...current, ...patch };
      const validation = validateEntry(next);
      if (!validation.success) return validation;
      setEntries((list) => list.map((entry) => (entry.id === id ? next : entry)));
      return { success: true };
    };

    const addProject = (project: Omit<Project, "id">): StoreResult => {
      if (!project.name.trim()) return { success: false, error: "A project name is required." };
      if (!clients.some((client) => client.id === project.clientId)) {
        return { success: false, error: "Choose an existing client for this project." };
      }
      setProjects((list) => [{ ...project, name: project.name.trim(), id: nextId("p") }, ...list]);
      return { success: true };
    };

    const updateProject = (id: string, patch: Partial<Omit<Project, "id">>): StoreResult => {
      const current = projects.find((project) => project.id === id);
      if (!current) return { success: false, error: "This project no longer exists." };
      const next = { ...current, ...patch, name: (patch.name ?? current.name).trim() };
      if (!next.name) return { success: false, error: "A project name is required." };
      if (!clients.some((client) => client.id === next.clientId)) {
        return { success: false, error: "A project must keep a valid client." };
      }
      setProjects((list) => list.map((project) => (project.id === id ? next : project)));
      return { success: true };
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
      addEntry,
      updateEntry,
      deleteEntry: (id) => setEntries((list) => list.filter((e) => e.id !== id)),
      addProject,
      updateProject,
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

export function useProjectName(): (id: string | null) => string {
  const { projects } = useStore();
  return (id: string | null) =>
    id === null ? "No project" : (projects.find((p) => p.id === id)?.name ?? "Unknown project");
}
