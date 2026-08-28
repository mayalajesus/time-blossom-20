import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  clients as seedClients,
  currentUserId as defaultCurrentUserId,
  members as seedMembers,
  projects as seedProjects,
  timeEntries as seedEntries,
} from "./mock-data";
import type { Client, Member, Project, Role, TimeEntry, TrelloState } from "./mock-data";
import {
  addSecondsToDateTime,
  dateTimeToTimestamp,
  getElapsedSeconds,
  getEndDateForEntry,
  getLocalToday,
  isValidDateOnly,
  nowTime,
} from "./format";
import { defaultLocale, isLocale, type Locale } from "./i18n";

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

const ACTIVE_MEMBER_STORAGE_KEY = "time-blossom:active-member:v1";
const SESSION_STORAGE_KEY = "time-blossom:session:v1";
const TIMER_STORAGE_KEY = (memberId: string) => `time-blossom:active-timer:v2:${memberId}`;
const WORKSPACE_STORAGE_KEY = "time-blossom:workspace:v8";
const LEGACY_WORKSPACE_STORAGE_KEYS = [
  `time-blossom:workspace:v7`,
  `time-blossom:workspace:v6`,
  `time-blossom:workspace:v5`,
  `time-blossom:workspace:v4:${defaultCurrentUserId}`,
  `time-blossom:workspace:v3:${defaultCurrentUserId}`,
  `time-blossom:workspace:v2:${defaultCurrentUserId}`,
];

function isValidClock(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidTimerSnapshot(
  value: unknown,
  availableProjects = seedProjects,
): value is TimerState {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<TimerState>;
  if (snapshot.status !== "running" && snapshot.status !== "paused") return false;
  if (typeof snapshot.task !== "string" || !snapshot.task.trim()) return false;
  if (snapshot.projectId !== null && typeof snapshot.projectId !== "string") return false;
  if (
    snapshot.projectId !== null &&
    !availableProjects.some((project) => project.id === snapshot.projectId)
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

function readPersistedTimer(memberId: string, availableProjects = seedProjects): TimerState {
  if (typeof window === "undefined") return initialTimer;

  try {
    const key = TIMER_STORAGE_KEY(memberId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return initialTimer;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidTimerSnapshot(parsed, availableProjects)) {
      window.localStorage.removeItem(key);
      return initialTimer;
    }
    return parsed;
  } catch {
    try {
      window.localStorage.removeItem(TIMER_STORAGE_KEY(memberId));
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
  weekStart: "monday" | "sunday";
}

export type ThemeMode = "system" | "light" | "dark";
export type SessionStatus = "active" | "signed-out";

export interface UserPreferences {
  reminders: boolean;
  weeklyDigest: boolean;
  idleDetection: boolean;
  language: Locale;
  theme: ThemeMode;
  avatarUrl: string | null;
}

export type Permission =
  | "track-own-time"
  | "manage-own-entries"
  | "manage-projects"
  | "manage-clients"
  | "manage-project-members"
  | "manage-members"
  | "manage-admins"
  | "view-all-reports"
  | "export-all-reports"
  | "manage-workspace-settings"
  | "manage-integrations";

const initialSettings: WorkspaceSettings = {
  workspaceName: "Studio Co.",
  defaultBillable: true,
  weekStart: "monday",
};

const initialPreferences: UserPreferences = {
  reminders: true,
  weeklyDigest: false,
  idleDetection: true,
  language: defaultLocale,
  theme: "system",
  avatarUrl: null,
};

type PersistedWorkspace = {
  version: 8;
  entries: TimeEntry[];
  projects: Project[];
  clients: Client[];
  members: Member[];
  settings: WorkspaceSettings;
  preferencesByMemberId: Record<string, UserPreferences>;
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function isValidAvatarUrl(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=\r\n]+$/.test(value) &&
      value.length <= 1_500_000)
  );
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function isValidTimeEntrySnapshot(
  value: unknown,
  availableProjects: Project[],
): value is TimeEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<TimeEntry>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.date !== "string" ||
    typeof entry.start !== "string" ||
    typeof entry.end !== "string" ||
    typeof entry.seconds !== "number" ||
    typeof entry.userId !== "string" ||
    typeof entry.task !== "string" ||
    typeof entry.billable !== "boolean"
  ) {
    return false;
  }
  if (!isValidDateOnly(entry.date) || !isValidDateOnly(entry.endDate ?? entry.date)) return false;
  if (entry.endDate && entry.endDate < entry.date) return false;
  if (!isValidClock(entry.start) || !isValidClock(entry.end)) return false;
  if (entry.projectId !== null && typeof entry.projectId !== "string") return false;
  if (
    entry.projectId !== null &&
    !availableProjects.some((project) => project.id === entry.projectId)
  ) {
    return false;
  }
  if (!entry.task.trim() || !isFiniteNumber(entry.seconds) || entry.seconds <= 0) return false;
  if (entry.startTimestamp !== undefined && !isFiniteNumber(entry.startTimestamp)) return false;
  if (entry.endTimestamp !== undefined && !isFiniteNumber(entry.endTimestamp)) return false;
  if ((entry.startTimestamp === undefined) !== (entry.endTimestamp === undefined)) return false;
  if (
    entry.startTimestamp !== undefined &&
    entry.endTimestamp !== undefined &&
    entry.endTimestamp < entry.startTimestamp
  ) {
    return false;
  }
  const elapsedSeconds = getElapsedSeconds(entry as TimeEntry);
  if (elapsedSeconds <= 0 || Math.abs(elapsedSeconds - entry.seconds) > 1) return false;
  return true;
}

function isValidClientSnapshot(value: unknown): value is Client {
  if (!value || typeof value !== "object") return false;
  const client = value as Partial<Client>;
  return (
    typeof client.id === "string" &&
    typeof client.name === "string" &&
    Boolean(client.name.trim()) &&
    typeof client.contact === "string"
  );
}

function isValidProjectSnapshot(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<Project>;
  return (
    typeof project.id === "string" &&
    typeof project.name === "string" &&
    Boolean(project.name.trim()) &&
    typeof project.clientId === "string" &&
    typeof project.billable === "boolean" &&
    (project.status === "active" ||
      project.status === "on-hold" ||
      project.status === "archived") &&
    typeof project.color === "string" &&
    typeof project.lastActivity === "string" &&
    Array.isArray(project.memberIds) &&
    project.memberIds.every((memberId) => typeof memberId === "string")
  );
}

function isValidMemberSnapshot(value: unknown): value is Member {
  if (!value || typeof value !== "object") return false;
  const member = value as Partial<Member>;
  return (
    typeof member.id === "string" &&
    typeof member.name === "string" &&
    Boolean(member.name.trim()) &&
    typeof member.email === "string" &&
    Boolean(member.email.trim()) &&
    (member.role === "Owner" || member.role === "Admin" || member.role === "Member") &&
    (member.status === "active" || member.status === "invited" || member.status === "removed") &&
    typeof member.initials === "string" &&
    (!member.invitedAt || typeof member.invitedAt === "string")
  );
}

function isValidSettingsSnapshot(value: unknown): value is WorkspaceSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<WorkspaceSettings>;
  return (
    typeof settings.workspaceName === "string" &&
    typeof settings.defaultBillable === "boolean" &&
    (settings.weekStart === "monday" || settings.weekStart === "sunday")
  );
}

function isValidLegacySettingsSnapshot(value: unknown): value is {
  workspaceName: string;
  defaultBillable: boolean;
  weekStart: "monday" | "sunday";
} {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<WorkspaceSettings>;
  return (
    typeof settings.workspaceName === "string" &&
    typeof settings.defaultBillable === "boolean" &&
    (settings.weekStart === "monday" || settings.weekStart === "sunday")
  );
}

function isValidPreferencesSnapshot(value: unknown): value is UserPreferences {
  if (!value || typeof value !== "object") return false;
  const preferences = value as Partial<UserPreferences>;
  return (
    typeof preferences.reminders === "boolean" &&
    typeof preferences.weeklyDigest === "boolean" &&
    typeof preferences.idleDetection === "boolean" &&
    isLocale(preferences.language) &&
    isThemeMode(preferences.theme) &&
    isValidAvatarUrl(preferences.avatarUrl)
  );
}

function isValidPreferencesMap(value: unknown): value is Record<string, UserPreferences> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(isValidPreferencesSnapshot);
}

function isValidWorkspaceSnapshot(value: unknown): value is PersistedWorkspace {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<PersistedWorkspace>;
  if (snapshot.version !== 8) return false;
  if (!Array.isArray(snapshot.projects) || !Array.isArray(snapshot.clients)) return false;
  if (!Array.isArray(snapshot.members)) return false;
  if (
    !Array.isArray(snapshot.entries) ||
    !isValidSettingsSnapshot(snapshot.settings) ||
    !isValidPreferencesMap(snapshot.preferencesByMemberId)
  ) {
    return false;
  }
  if (!snapshot.clients.every(isValidClientSnapshot)) return false;
  if (!snapshot.members.every(isValidMemberSnapshot)) return false;
  if (
    !snapshot.projects.every(
      (project) =>
        isValidProjectSnapshot(project) &&
        snapshot.clients?.some((client) => client.id === project.clientId),
    )
  ) {
    return false;
  }
  return snapshot.entries.every((entry) =>
    isValidTimeEntrySnapshot(entry, snapshot.projects ?? []),
  );
}

function migrateLegacyWorkspace(value: unknown): PersistedWorkspace | null {
  if (!value || typeof value !== "object") return null;
  const legacy = value as {
    version?: unknown;
    entries?: unknown;
    projects?: unknown;
    clients?: unknown;
    members?: unknown;
    settings?: unknown;
    preferencesByMemberId?: unknown;
  };
  const legacySettings = legacy.settings;
  if (
    (legacy.version !== 2 &&
      legacy.version !== 3 &&
      legacy.version !== 4 &&
      legacy.version !== 5 &&
      legacy.version !== 6 &&
      legacy.version !== 7) ||
    !Array.isArray(legacy.entries) ||
    !Array.isArray(legacy.projects) ||
    !Array.isArray(legacy.clients) ||
    !isValidLegacySettingsSnapshot(legacySettings)
  ) {
    return null;
  }

  const legacyClients = legacy.clients as Array<Record<string, unknown>>;
  const clients = legacyClients.map((client) => ({
    id: client["id"],
    name: client["name"],
    contact: typeof client["contact"] === "string" ? client["contact"].trim() : "",
  })) as unknown[];
  if (!clients.every(isValidClientSnapshot)) return null;

  const legacyBillability = new Map(
    legacyClients.map((client) => [
      String(client["id"]),
      typeof client["billable"] === "boolean" ? client["billable"] : legacySettings.defaultBillable,
    ]),
  );
  const projects = legacy.projects.map((rawProject) => {
    if (!rawProject || typeof rawProject !== "object") return null;
    const project = rawProject as Record<string, unknown>;
    const billable =
      typeof project["billable"] === "boolean"
        ? project["billable"]
        : (legacyBillability.get(String(project["clientId"])) ?? legacySettings.defaultBillable);
    const normalized = { ...project, billable };
    return isValidProjectSnapshot(normalized) ? normalized : null;
  });
  if (!projects.every(isValidProjectSnapshot)) return null;

  const normalizedClients = clients as Client[];
  const normalizedProjects = projects as Project[];
  const normalizedMembers =
    legacy.members === undefined
      ? seedMembers
      : Array.isArray(legacy.members) && legacy.members.every(isValidMemberSnapshot)
        ? (legacy.members as Member[])
        : null;
  if (!normalizedMembers) return null;
  if (
    !normalizedProjects.every((project) =>
      normalizedClients.some((client) => client.id === project.clientId),
    )
  ) {
    return null;
  }
  if (!legacy.entries.every((entry) => isValidTimeEntrySnapshot(entry, normalizedProjects))) {
    return null;
  }

  const legacySettingsWithPreferences = legacySettings as WorkspaceSettings &
    Partial<UserPreferences>;
  const preferencesByMemberId: Record<string, UserPreferences> = {};
  for (const member of normalizedMembers) {
    const stored =
      legacy.preferencesByMemberId &&
      typeof legacy.preferencesByMemberId === "object" &&
      !Array.isArray(legacy.preferencesByMemberId)
        ? (legacy.preferencesByMemberId as Record<string, unknown>)[member.id]
        : undefined;
    const candidate =
      stored && typeof stored === "object" && !Array.isArray(stored)
        ? (stored as Record<string, unknown>)
        : {};
    preferencesByMemberId[member.id] = {
      reminders:
        typeof candidate.reminders === "boolean"
          ? candidate.reminders
          : (legacySettingsWithPreferences.reminders ?? initialPreferences.reminders),
      weeklyDigest:
        typeof candidate.weeklyDigest === "boolean"
          ? candidate.weeklyDigest
          : (legacySettingsWithPreferences.weeklyDigest ?? initialPreferences.weeklyDigest),
      idleDetection:
        typeof candidate.idleDetection === "boolean"
          ? candidate.idleDetection
          : (legacySettingsWithPreferences.idleDetection ?? initialPreferences.idleDetection),
      language: isLocale(candidate.language) ? candidate.language : defaultLocale,
      theme: isThemeMode(candidate.theme) ? candidate.theme : initialPreferences.theme,
      avatarUrl: isValidAvatarUrl(candidate.avatarUrl) ? candidate.avatarUrl : null,
    };
  }

  return {
    version: 8,
    entries: legacy.entries,
    projects: normalizedProjects,
    clients: normalizedClients,
    members: normalizedMembers,
    settings: {
      workspaceName: legacySettings.workspaceName,
      defaultBillable: legacySettings.defaultBillable,
      weekStart: legacySettings.weekStart,
    },
    preferencesByMemberId,
  };
}

function readPersistedWorkspace(): PersistedWorkspace {
  const fallback: PersistedWorkspace = {
    version: 8,
    entries: seedEntries,
    projects: seedProjects,
    clients: seedClients,
    members: seedMembers,
    settings: initialSettings,
    preferencesByMemberId: Object.fromEntries(
      seedMembers.map((member) => [member.id, { ...initialPreferences }]),
    ),
  };
  if (typeof window === "undefined") return fallback;

  try {
    for (const key of [WORKSPACE_STORAGE_KEY, ...LEGACY_WORKSPACE_STORAGE_KEYS]) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (isValidWorkspaceSnapshot(parsed)) return parsed;
      const migrated = migrateLegacyWorkspace(parsed);
      if (migrated) {
        window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(migrated));
        if (LEGACY_WORKSPACE_STORAGE_KEYS.includes(key)) {
          window.localStorage.removeItem(key);
        }
        return migrated;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function readActiveMemberId(availableMembers: Member[]): string {
  if (typeof window === "undefined") return defaultCurrentUserId;
  try {
    const stored = window.localStorage.getItem(ACTIVE_MEMBER_STORAGE_KEY);
    if (
      stored &&
      availableMembers.some((member) => member.id === stored && member.status === "active")
    ) {
      return stored;
    }
    window.localStorage.removeItem(ACTIVE_MEMBER_STORAGE_KEY);
  } catch {
    // Fall back to the seeded owner when local storage is unavailable.
  }
  return availableMembers.some(
    (member) => member.id === defaultCurrentUserId && member.status === "active",
  )
    ? defaultCurrentUserId
    : (availableMembers.find((member) => member.status === "active")?.id ?? defaultCurrentUserId);
}

function readSessionStatus(): SessionStatus {
  if (typeof window === "undefined") return "active";
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY) === "signed-out"
      ? "signed-out"
      : "active";
  } catch {
    return "active";
  }
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
  preferences: UserPreferences;
  currentMember: Member | null;
  sessionStatus: SessionStatus;
  can: (permission: Permission) => boolean;
  canTrackProject: (projectId: string) => boolean;
  setActiveMember: (memberId: string) => StoreResult;
  currentUserId: string;
  today: string;
  startTimer: (task: string, projectId: string | null, billable?: boolean) => StoreResult;
  updateTimer: (patch: {
    task?: string;
    projectId?: string | null;
    billable?: boolean;
  }) => StoreResult;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  addEntry: (entry: Omit<TimeEntry, "id">) => StoreResult;
  updateEntry: (id: string, patch: Partial<Omit<TimeEntry, "id">>) => StoreResult;
  deleteEntry: (id: string) => StoreResult;
  restoreEntry: (entry: TimeEntry) => StoreResult;
  addProject: (project: Omit<Project, "id">) => StoreResult;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => StoreResult;
  addClient: (client: Omit<Client, "id">) => StoreResult;
  updateClient: (id: string, patch: Partial<Client>) => StoreResult;
  deleteClient: (id: string) => StoreResult;
  inviteMember: (email: string, role: Exclude<Role, "Owner">) => StoreResult;
  resendInvite: (memberId: string) => StoreResult;
  cancelInvite: (memberId: string) => StoreResult;
  removeMember: (memberId: string) => StoreResult;
  restoreMember: (memberId: string) => StoreResult;
  updateMemberRole: (memberId: string, role: Exclude<Role, "Owner">) => StoreResult;
  setTrello: (patch: Partial<TrelloState>) => StoreResult;
  setWorkspaceSettings: (patch: Partial<WorkspaceSettings>) => StoreResult;
  setUserPreferences: (patch: Partial<UserPreferences>) => StoreResult;
  updateCurrentMemberEmail: (email: string) => StoreResult;
  signOut: () => StoreResult;
  resumeSession: (memberId: string) => StoreResult;
}

const StoreContext = createContext<StoreValue | null>(null);

let idCounter = 100;
const nextId = (prefix: string) => `${prefix}${++idCounter}`;

const inviteEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function displayNameFromInviteEmail(email: string): string {
  const localPart = email
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();
  if (!localPart) return email;
  return localPart.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initialsFromName(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [workspaceSnapshot] = useState<PersistedWorkspace>(() => readPersistedWorkspace());
  const [activeMemberId, setActiveMemberId] = useState(() =>
    readActiveMemberId(workspaceSnapshot.members),
  );
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(() => readSessionStatus());
  const [entries, setEntries] = useState<TimeEntry[]>(workspaceSnapshot.entries);
  const [projects, setProjects] = useState<Project[]>(workspaceSnapshot.projects);
  const [clients, setClients] = useState<Client[]>(workspaceSnapshot.clients);
  const [members, setMembers] = useState<Member[]>(workspaceSnapshot.members);
  const [timer, setTimer] = useState<TimerState>(() =>
    readPersistedTimer(activeMemberId, workspaceSnapshot.projects),
  );
  const [trello, setTrelloState] = useState<TrelloState>(initialTrello);
  const [elapsed, setElapsed] = useState(() => elapsedForTimer(timer));
  const [settings, setSettingsState] = useState<WorkspaceSettings>(workspaceSnapshot.settings);
  const [preferencesByMemberId, setPreferencesByMemberId] = useState(
    workspaceSnapshot.preferencesByMemberId,
  );
  const [today, setToday] = useState(() => getLocalToday());

  const currentMember = members.find((member) => member.id === activeMemberId) ?? null;
  const preferences = preferencesByMemberId[activeMemberId] ?? initialPreferences;

  const timerRef = useRef(timer);
  timerRef.current = timer;

  useEffect(() => {
    try {
      if (timer.status === "idle") {
        window.localStorage.removeItem(TIMER_STORAGE_KEY(activeMemberId));
      } else {
        window.localStorage.setItem(TIMER_STORAGE_KEY(activeMemberId), JSON.stringify(timer));
      }
    } catch {
      // The timer remains usable when browser storage is unavailable.
    }
  }, [activeMemberId, timer]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({
          version: 8,
          entries,
          projects,
          clients,
          members,
          settings,
          preferencesByMemberId,
        }),
      );
    } catch {
      // The workspace remains usable when browser storage is unavailable.
    }
  }, [clients, entries, members, preferencesByMemberId, projects, settings]);

  useEffect(() => {
    const refreshToday = () => setToday(getLocalToday());
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") refreshToday();
    };

    refreshToday();
    const id = window.setInterval(refreshToday, 60_000);
    window.addEventListener("focus", refreshToday);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refreshToday);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, []);

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
    const can = (permission: Permission): boolean => {
      if (sessionStatus !== "active" || !currentMember || currentMember.status !== "active") {
        return false;
      }
      if (currentMember.role === "Owner") return true;
      if (currentMember.role === "Admin") {
        return permission !== "manage-admins";
      }
      return permission === "track-own-time" || permission === "manage-own-entries";
    };

    const canTrackProject = (projectId: string): boolean => {
      if (sessionStatus !== "active" || !currentMember || currentMember.status !== "active") {
        return false;
      }
      const project = projects.find((candidate) => candidate.id === projectId);
      if (!project) return false;
      return currentMember?.role !== "Member" || project.memberIds.includes(activeMemberId);
    };

    const validateProjectId = (projectId: string | null): StoreResult => {
      if (projectId === null) return { success: true };
      if (projects.some((project) => project.id === projectId) && canTrackProject(projectId)) {
        return { success: true };
      }
      if (projects.some((project) => project.id === projectId)) {
        return { success: false, error: "This project is not assigned to your team member." };
      }
      return { success: false, error: "Choose an existing project or No project." };
    };

    const validateEntry = (
      entry: Omit<TimeEntry, "id">,
      options: { allowExistingProjectId?: string | null } = {},
    ): StoreResult => {
      const projectValidation = validateProjectId(entry.projectId);
      if (
        !projectValidation.success &&
        (entry.projectId !== options.allowExistingProjectId ||
          !projects.some((project) => project.id === entry.projectId))
      ) {
        return projectValidation;
      }
      if (!entry.task.trim()) return { success: false, error: "A task is required." };
      if (!isValidDateOnly(entry.date)) return { success: false, error: "Choose a valid date." };
      if (entry.endDate && !isValidDateOnly(entry.endDate)) {
        return { success: false, error: "Choose a valid end date." };
      }
      if (entry.endDate && entry.endDate < entry.date) {
        return { success: false, error: "End date cannot be before the start date." };
      }
      const endDate = getEndDateForEntry(entry);
      const elapsedSeconds = getElapsedSeconds({ ...entry, endDate });
      if (elapsedSeconds <= 0 || entry.seconds <= 0) {
        return { success: false, error: "End time must be after start time." };
      }
      if (Math.abs(elapsedSeconds - entry.seconds) > 1) {
        return { success: false, error: "Duration must match the selected time range." };
      }
      return { success: true };
    };

    const startTimer = (
      task: string,
      projectId: string | null,
      billable?: boolean,
    ): StoreResult => {
      if (!can("track-own-time")) {
        return { success: false, error: "Your account cannot track time." };
      }
      if (timerRef.current.status !== "idle") {
        return { success: false, error: "Stop the active timer before starting another one." };
      }
      const projectValidation = validateProjectId(projectId);
      if (!projectValidation.success) return projectValidation;
      const projectDefault =
        projectId === null
          ? settings.defaultBillable
          : (projects.find((project) => project.id === projectId)?.billable ??
            settings.defaultBillable);
      setElapsed(0);
      const next = {
        status: "running",
        task: task.trim() || "Untitled task",
        projectId,
        billable: billable ?? projectDefault,
        startedAt: Date.now(),
        startedDate: getLocalToday(),
        accumulated: 0,
        startClock: nowTime(),
      } satisfies TimerState;
      timerRef.current = next;
      setTimer(next);
      return { success: true };
    };

    const updateTimer = (patch: {
      task?: string;
      projectId?: string | null;
      billable?: boolean;
    }): StoreResult => {
      if (!can("track-own-time")) {
        return { success: false, error: "Your account cannot update the active timer." };
      }
      const current = timerRef.current;
      if (current.status === "idle") {
        return { success: false, error: "There is no active timer to update." };
      }
      if (patch.projectId !== undefined) {
        const projectValidation = validateProjectId(patch.projectId);
        if (!projectValidation.success) return projectValidation;
      }
      if (patch.task !== undefined && !patch.task.trim()) {
        return { success: false, error: "A task is required." };
      }
      const next = {
        ...current,
        ...patch,
        ...(patch.task !== undefined ? { task: patch.task.trim() } : {}),
      };
      timerRef.current = next;
      setTimer(next);
      return { success: true };
    };

    const pauseTimer = () => {
      const t = timerRef.current;
      if (t.status !== "running") return;
      const total = elapsedForTimer(t);
      setElapsed(total);
      const next = { ...t, status: "paused" as const, accumulated: total, startedAt: null };
      timerRef.current = next;
      setTimer(next);
    };

    const resumeTimer = () => {
      const t = timerRef.current;
      if (t.status !== "paused") return;
      const next = { ...t, status: "running" as const, startedAt: Date.now() };
      timerRef.current = next;
      setTimer(next);
    };

    const stopTimer = () => {
      const t = timerRef.current;
      if (t.status === "idle") return;
      const total = elapsedForTimer(t);
      const startedDate = t.startedDate ?? getLocalToday();
      const finish = addSecondsToDateTime(startedDate, t.startClock, total);
      if (total > 0) {
        const startTimestamp = dateTimeToTimestamp(startedDate, t.startClock);
        const endTimestamp = startTimestamp === null ? null : startTimestamp + total * 1000;
        setEntries((list) => [
          {
            id: nextId("t"),
            date: startedDate,
            start: t.startClock,
            end: finish.end,
            ...(finish.endDate !== startedDate ? { endDate: finish.endDate } : {}),
            ...(startTimestamp !== null ? { startTimestamp } : {}),
            ...(endTimestamp !== null ? { endTimestamp } : {}),
            seconds: total,
            userId: activeMemberId,
            projectId: t.projectId,
            task: t.task,
            billable: t.billable,
          },
          ...list,
        ]);
      }
      setElapsed(0);
      timerRef.current = initialTimer;
      setTimer(initialTimer);
    };

    const addEntry = (entry: Omit<TimeEntry, "id">): StoreResult => {
      if (!can("manage-own-entries") || entry.userId !== activeMemberId) {
        return { success: false, error: "You can only create your own time entries." };
      }
      if (timerRef.current.status !== "idle") {
        return { success: false, error: "Stop the active timer before adding time manually." };
      }
      const validation = validateEntry(entry);
      if (!validation.success) return validation;
      setEntries((list) => [{ ...entry, id: nextId("t") }, ...list]);
      return { success: true };
    };

    const updateEntry = (id: string, patch: Partial<Omit<TimeEntry, "id">>): StoreResult => {
      const current = entries.find((entry) => entry.id === id);
      if (!current) return { success: false, error: "This time entry no longer exists." };
      if (!can("manage-own-entries") || current.userId !== activeMemberId) {
        return { success: false, error: "You can only edit your own time entries." };
      }
      if (patch.userId !== undefined && patch.userId !== current.userId) {
        return { success: false, error: "A time entry owner cannot be changed." };
      }
      const next = { ...current, ...patch };
      const timeChanged = ["date", "start", "end", "endDate", "seconds"].some(
        (field) => field in patch,
      );
      if (timeChanged && !("startTimestamp" in patch) && !("endTimestamp" in patch)) {
        const onlyDateChanged =
          "date" in patch &&
          !["start", "end", "endDate", "seconds"].some((field) => field in patch);
        const preservedStart =
          onlyDateChanged && typeof current.startTimestamp === "number"
            ? dateTimeToTimestamp(next.date, next.start)
            : null;
        if (preservedStart !== null) {
          next.startTimestamp = preservedStart;
          next.endTimestamp = preservedStart + next.seconds * 1000;
        } else {
          delete next.startTimestamp;
          delete next.endTimestamp;
        }
      }
      const validation = validateEntry(next, { allowExistingProjectId: current.projectId });
      if (!validation.success) return validation;
      setEntries((list) => list.map((entry) => (entry.id === id ? next : entry)));
      return { success: true };
    };

    const restoreEntry = (entry: TimeEntry): StoreResult => {
      if (!can("manage-own-entries") || entry.userId !== activeMemberId) {
        return { success: false, error: "You can only restore your own time entries." };
      }
      if (entries.some((current) => current.id === entry.id)) {
        return { success: false, error: "This time entry already exists." };
      }
      const validation = validateEntry(entry);
      if (!validation.success) return validation;
      setEntries((list) => [entry, ...list]);
      return { success: true };
    };

    const addProject = (project: Omit<Project, "id">): StoreResult => {
      if (!can("manage-projects")) {
        return { success: false, error: "Only Admins and the Owner can manage projects." };
      }
      if (!project.name.trim()) return { success: false, error: "A project name is required." };
      if (!clients.some((client) => client.id === project.clientId)) {
        return { success: false, error: "Choose an existing client for this project." };
      }
      if (typeof project.billable !== "boolean") {
        return { success: false, error: "Choose whether this project is billable." };
      }
      if (!can("manage-project-members")) {
        return { success: false, error: "You cannot assign members to projects." };
      }
      if (
        project.memberIds.some(
          (memberId) =>
            !members.some((member) => member.id === memberId && member.status === "active"),
        )
      ) {
        return { success: false, error: "Only active members can be assigned to a project." };
      }
      setProjects((list) => [
        {
          ...project,
          name: project.name.trim(),
          memberIds: [...new Set([...project.memberIds, activeMemberId])],
          id: nextId("p"),
        },
        ...list,
      ]);
      return { success: true };
    };

    const updateProject = (id: string, patch: Partial<Omit<Project, "id">>): StoreResult => {
      if (!can("manage-projects")) {
        return { success: false, error: "Only Admins and the Owner can manage projects." };
      }
      const current = projects.find((project) => project.id === id);
      if (!current) return { success: false, error: "This project no longer exists." };
      const next = { ...current, ...patch, name: (patch.name ?? current.name).trim() };
      if (!next.name) return { success: false, error: "A project name is required." };
      if (!clients.some((client) => client.id === next.clientId)) {
        return { success: false, error: "A project must keep a valid client." };
      }
      if (typeof next.billable !== "boolean") {
        return { success: false, error: "Choose whether this project is billable." };
      }
      if ("memberIds" in patch && !can("manage-project-members")) {
        return { success: false, error: "You cannot assign members to projects." };
      }
      if (
        next.memberIds.some(
          (memberId) =>
            !members.some((member) => member.id === memberId && member.status === "active"),
        )
      ) {
        return { success: false, error: "Only active members can be assigned to a project." };
      }
      setProjects((list) => list.map((project) => (project.id === id ? next : project)));
      return { success: true };
    };

    const validateClient = (client: Omit<Client, "id">): StoreResult => {
      if (!client.name.trim()) return { success: false, error: "A client name is required." };
      return { success: true };
    };

    const addClient = (client: Omit<Client, "id">): StoreResult => {
      if (!can("manage-clients")) {
        return { success: false, error: "Only Admins and the Owner can manage clients." };
      }
      const validation = validateClient(client);
      if (!validation.success) return validation;
      setClients((list) => [
        { id: nextId("c"), name: client.name.trim(), contact: client.contact.trim() },
        ...list,
      ]);
      return { success: true };
    };

    const updateClient = (id: string, patch: Partial<Client>): StoreResult => {
      if (!can("manage-clients")) {
        return { success: false, error: "Only Admins and the Owner can manage clients." };
      }
      const current = clients.find((client) => client.id === id);
      if (!current) return { success: false, error: "This client no longer exists." };
      const next = {
        ...current,
        ...patch,
        name: (patch.name ?? current.name).trim(),
        contact: (patch.contact ?? current.contact).trim(),
      };
      const validation = validateClient(next);
      if (!validation.success) return validation;
      setClients((list) => list.map((client) => (client.id === id ? next : client)));
      return { success: true };
    };

    const deleteClient = (id: string): StoreResult => {
      if (!can("manage-clients")) {
        return { success: false, error: "Only Admins and the Owner can manage clients." };
      }
      const current = clients.find((client) => client.id === id);
      if (!current) return { success: false, error: "This client no longer exists." };
      const linkedProjects = projects.filter((project) => project.clientId === id);
      if (linkedProjects.length > 0) {
        return {
          success: false,
          error: `This client is used by ${linkedProjects.length} project${linkedProjects.length === 1 ? "" : "s"}. Remove or reassign those projects first.`,
        };
      }
      setClients((list) => list.filter((client) => client.id !== id));
      return { success: true };
    };

    const inviteMember = (email: string, role: Exclude<Role, "Owner">): StoreResult => {
      if (!can("manage-members")) {
        return { success: false, error: "Only Admins and the Owner can invite members." };
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (!inviteEmailPattern.test(normalizedEmail)) {
        return { success: false, error: "Enter a valid email address." };
      }
      if (role !== "Admin" && role !== "Member") {
        return { success: false, error: "Choose a valid role for this invitation." };
      }
      if (role === "Admin" && !can("manage-admins")) {
        return { success: false, error: "Only the Owner can invite Admins." };
      }
      if (members.some((member) => member.email.trim().toLowerCase() === normalizedEmail)) {
        return {
          success: false,
          error: "This email is already part of the team or has a pending invitation.",
        };
      }

      const name = displayNameFromInviteEmail(normalizedEmail);
      const invitation: Member = {
        id: nextId("u"),
        name,
        email: normalizedEmail,
        role,
        status: "invited",
        initials: initialsFromName(name),
        invitedAt: new Date().toISOString(),
      };
      setMembers((list) => [invitation, ...list]);
      return { success: true };
    };

    const resendInvite = (memberId: string): StoreResult => {
      if (!can("manage-members")) {
        return { success: false, error: "Only Admins and the Owner can manage invitations." };
      }
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member) return { success: false, error: "This invitation no longer exists." };
      if (member.status !== "invited") {
        return { success: false, error: "Only pending invitations can be resent." };
      }
      if (member.role === "Admin" && !can("manage-admins")) {
        return { success: false, error: "Only the Owner can manage Admin invitations." };
      }
      setMembers((list) =>
        list.map((candidate) =>
          candidate.id === memberId
            ? { ...candidate, invitedAt: new Date().toISOString() }
            : candidate,
        ),
      );
      return { success: true };
    };

    const cancelInvite = (memberId: string): StoreResult => {
      if (!can("manage-members")) {
        return { success: false, error: "Only Admins and the Owner can manage invitations." };
      }
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member) return { success: false, error: "This invitation no longer exists." };
      if (member.status !== "invited") {
        return { success: false, error: "Only pending invitations can be canceled." };
      }
      if (member.role === "Admin" && !can("manage-admins")) {
        return { success: false, error: "Only the Owner can manage Admin invitations." };
      }
      setMembers((list) => list.filter((candidate) => candidate.id !== memberId));
      return { success: true };
    };

    const removeMember = (memberId: string): StoreResult => {
      if (!can("manage-members")) {
        return { success: false, error: "Only Admins and the Owner can remove members." };
      }
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member) return { success: false, error: "This team member no longer exists." };
      if (memberId === activeMemberId && currentMember?.role === "Owner") {
        return { success: false, error: "The Owner cannot remove their own account." };
      }
      if (member.status !== "active") {
        return { success: false, error: "Only active members can be removed." };
      }
      if (member.role === "Owner") {
        return { success: false, error: "The workspace owner cannot be removed." };
      }
      if (member.role === "Admin" && !can("manage-admins")) {
        return { success: false, error: "Only the Owner can remove Admins." };
      }

      const activeAdmins = members.filter(
        (candidate) => candidate.status === "active" && candidate.role === "Admin",
      );
      if (member.role === "Admin" && activeAdmins.length <= 1) {
        return { success: false, error: "The last admin cannot be removed." };
      }

      setMembers((list) =>
        list.map((candidate) =>
          candidate.id === memberId ? { ...candidate, status: "removed" as const } : candidate,
        ),
      );
      setProjects((list) =>
        list.map((project) => ({
          ...project,
          memberIds: project.memberIds.filter((id) => id !== memberId),
        })),
      );
      return { success: true };
    };

    const restoreMember = (memberId: string): StoreResult => {
      if (!can("manage-members")) {
        return { success: false, error: "Only Admins and the Owner can restore members." };
      }
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member) return { success: false, error: "This team member no longer exists." };
      if (member.status !== "removed") {
        return { success: false, error: "Only removed members can be restored." };
      }
      if (member.role === "Admin" && !can("manage-admins")) {
        return { success: false, error: "Only the Owner can restore Admins." };
      }

      setMembers((list) =>
        list.map((candidate) =>
          candidate.id === memberId ? { ...candidate, status: "active" as const } : candidate,
        ),
      );
      return { success: true };
    };

    const updateMemberRole = (memberId: string, role: Exclude<Role, "Owner">): StoreResult => {
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member) return { success: false, error: "This team member no longer exists." };
      if (memberId === activeMemberId && currentMember?.role === "Owner") {
        return { success: false, error: "The Owner cannot change their own role." };
      }
      if (member.role === "Owner") {
        return { success: false, error: "The workspace owner role cannot be changed." };
      }
      if (role !== "Admin" && role !== "Member") {
        return { success: false, error: "Choose a valid team role." };
      }
      if (currentMember?.role === "Admin" && member.role !== "Member") {
        return { success: false, error: "Admins can only manage Members." };
      }
      if (!can("manage-members")) {
        return { success: false, error: "Only Admins and the Owner can change roles." };
      }
      if (member.status !== "active" && currentMember?.role === "Admin") {
        return { success: false, error: "Admins can only promote active Members." };
      }
      if (member.role === "Admin" && role === "Member") {
        if (!can("manage-admins")) {
          return { success: false, error: "Only the Owner can reassign Admin roles." };
        }
        const activeAdmins = members.filter(
          (candidate) => candidate.status === "active" && candidate.role === "Admin",
        );
        if (member.status === "active" && activeAdmins.length <= 1) {
          return { success: false, error: "The last admin cannot be reassigned." };
        }
      }
      setMembers((list) =>
        list.map((candidate) => (candidate.id === memberId ? { ...candidate, role } : candidate)),
      );
      return { success: true };
    };

    const setActiveMember = (memberId: string): StoreResult => {
      if (sessionStatus !== "active") {
        return { success: false, error: "Sign in to change the preview identity." };
      }
      const member = members.find(
        (candidate) => candidate.id === memberId && candidate.status === "active",
      );
      if (!member) return { success: false, error: "Choose an active preview identity." };
      if (timerRef.current.status !== "idle") {
        return { success: false, error: "Stop the active timer before changing preview identity." };
      }
      try {
        window.localStorage.setItem(ACTIVE_MEMBER_STORAGE_KEY, memberId);
      } catch {
        return { success: false, error: "Preview identity could not be saved locally." };
      }
      timerRef.current = initialTimer;
      setTimer(initialTimer);
      setElapsed(0);
      setActiveMemberId(memberId);
      return { success: true };
    };

    const signOut = (): StoreResult => {
      if (timerRef.current.status !== "idle") {
        return { success: false, error: "Stop the active timer before signing out." };
      }
      try {
        window.localStorage.setItem(SESSION_STORAGE_KEY, "signed-out");
      } catch {
        return { success: false, error: "The session could not be ended locally." };
      }
      setSessionStatus("signed-out");
      return { success: true };
    };

    const resumeSession = (memberId: string): StoreResult => {
      const member = members.find(
        (candidate) => candidate.id === memberId && candidate.status === "active",
      );
      if (!member) return { success: false, error: "Choose an active preview identity." };
      if (timerRef.current.status !== "idle") {
        return { success: false, error: "Stop the active timer before changing preview identity." };
      }
      try {
        window.localStorage.setItem(ACTIVE_MEMBER_STORAGE_KEY, memberId);
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        return { success: false, error: "Preview identity could not be saved locally." };
      }
      timerRef.current = initialTimer;
      setTimer(initialTimer);
      setElapsed(0);
      setActiveMemberId(memberId);
      setSessionStatus("active");
      return { success: true };
    };

    const setWorkspaceSettings = (patch: Partial<WorkspaceSettings>): StoreResult => {
      if (!can("manage-workspace-settings")) {
        return {
          success: false,
          error: "Only Admins and the Owner can change workspace settings.",
        };
      }
      const next = { ...settings, ...patch };
      if (!next.workspaceName.trim()) {
        return { success: false, error: "Workspace name is required." };
      }
      if (typeof next.defaultBillable !== "boolean") {
        return { success: false, error: "Choose a valid default billability setting." };
      }
      if (next.weekStart !== "monday" && next.weekStart !== "sunday") {
        return { success: false, error: "Choose a valid week start." };
      }
      setSettingsState({ ...next, workspaceName: next.workspaceName.trim() });
      return { success: true };
    };

    const setUserPreferences = (patch: Partial<UserPreferences>): StoreResult => {
      if (sessionStatus !== "active" || !currentMember || currentMember.status !== "active") {
        return { success: false, error: "Choose an active preview identity." };
      }
      const next = { ...preferences, ...patch };
      if (
        typeof next.reminders !== "boolean" ||
        typeof next.weeklyDigest !== "boolean" ||
        typeof next.idleDetection !== "boolean" ||
        !isLocale(next.language) ||
        !isThemeMode(next.theme) ||
        !isValidAvatarUrl(next.avatarUrl)
      ) {
        return { success: false, error: "Choose valid personal preferences." };
      }
      setPreferencesByMemberId((map) => ({ ...map, [activeMemberId]: next }));
      return { success: true };
    };

    const updateCurrentMemberEmail = (email: string): StoreResult => {
      if (sessionStatus !== "active" || !currentMember || currentMember.status !== "active") {
        return { success: false, error: "Choose an active preview identity." };
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (!inviteEmailPattern.test(normalizedEmail)) {
        return { success: false, error: "Enter a valid email address." };
      }
      if (
        members.some(
          (member) =>
            member.id !== activeMemberId && member.email.toLowerCase() === normalizedEmail,
        )
      ) {
        return { success: false, error: "This email is already part of the team." };
      }
      setMembers((list) =>
        list.map((member) =>
          member.id === activeMemberId ? { ...member, email: normalizedEmail } : member,
        ),
      );
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
      preferences,
      currentMember,
      sessionStatus,
      can,
      canTrackProject,
      setActiveMember,
      currentUserId: activeMemberId,
      today,
      startTimer,
      updateTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      addEntry,
      updateEntry,
      deleteEntry: (id) => {
        const entry = entries.find((candidate) => candidate.id === id);
        if (!entry) return { success: false, error: "This time entry no longer exists." };
        if (!can("manage-own-entries") || entry.userId !== activeMemberId) {
          return { success: false, error: "You can only delete your own time entries." };
        }
        setEntries((list) => list.filter((e) => e.id !== id));
        return { success: true };
      },
      restoreEntry,
      addProject,
      updateProject,
      addClient,
      updateClient,
      deleteClient,
      inviteMember,
      resendInvite,
      cancelInvite,
      removeMember,
      restoreMember,
      updateMemberRole,
      setTrello: (patch) => {
        if (!can("manage-integrations")) {
          return { success: false, error: "Only Admins and the Owner can manage integrations." };
        }
        setTrelloState((s) => ({ ...s, ...patch }));
        return { success: true };
      },
      setWorkspaceSettings,
      setUserPreferences,
      updateCurrentMemberEmail,
      signOut,
      resumeSession,
    };
  }, [
    activeMemberId,
    clients,
    currentMember,
    elapsed,
    entries,
    members,
    preferences,
    projects,
    sessionStatus,
    settings,
    timer,
    today,
    trello,
  ]);

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
