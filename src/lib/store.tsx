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
import {
  canTrackProject as canTrackProjectForRole,
  hasPermission,
  type Permission,
} from "./permissions";
import { resetSessionDefaultAvatar } from "./default-avatar";
import {
  defaultCurrencyForLocale,
  isCurrencyCode,
  type BillingPreference,
  type CurrencyCode,
} from "./billing";
import {
  findTimeEntryConflict,
  timeEntriesOverlap,
  type ScopedTimeIntervalEntry,
} from "./time-entry-overlap";
import {
  createRunningTimer,
  recentTimerTasksFromEntries,
  rememberRecentTimerTask,
  validateTimerTaskStart,
  type TimerTaskPreset,
} from "./timer-start";

export { findTimeEntryConflict, timeEntriesOverlap } from "./time-entry-overlap";

export type TimerStatus = "idle" | "running" | "paused";

export interface TimerState {
  status: TimerStatus;
  workspaceId: string | null;
  task: string;
  projectId: string | null;
  billable: boolean;
  startedAt: number | null;
  startedDate: string | null;
  accumulated: number;
  startClock: string;
  hourlyRate?: number;
  currency?: CurrencyCode;
}

export type WorkspaceStatus = "active" | "archived";

export interface UserIdentity {
  id: string;
  name: string;
  email: string;
  initials: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  logoDataUrl: string | null;
  status: WorkspaceStatus;
  createdAt: string;
  archivedAt?: string;
}

export interface WorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: Role;
  status: Member["status"];
  invitedAt?: string;
  joinedAt?: string;
}

export interface WorkspaceSummary extends Workspace {
  ownerName: string;
  role: Role;
  membershipStatus: Member["status"];
  isOwned: boolean;
}

export interface WorkspaceSettings {
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
  timezone: string;
  hourlyRate: number;
  currency: CurrencyCode;
}

export type { Permission } from "./permissions";

export type StoreResult =
  | { success: true; id?: string; warning?: string; conflict?: TimeEntry }
  | { success: false; error: string };

type AddEntryOptions = {
  allowWhileTimerActive?: boolean;
  refreshBilling?: boolean;
};

export interface WorkspaceData {
  workspace: Workspace;
  memberships: WorkspaceMembership[];
  entries: TimeEntry[];
  projects: Project[];
  clients: Client[];
  settings: WorkspaceSettings;
  trello: TrelloState;
}

export type PersistedAccount = {
  version: 11;
  identities: UserIdentity[];
  workspaces: WorkspaceData[];
  preferencesByUserId: Record<string, UserPreferences>;
};

const initialTimer: TimerState = {
  status: "idle",
  workspaceId: null,
  task: "",
  projectId: null,
  billable: true,
  startedAt: null,
  startedDate: null,
  accumulated: 0,
  startClock: "09:00",
};

const initialSettings: WorkspaceSettings = {
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
  timezone: getInitialTimeZone(),
  hourlyRate: 0,
  currency: defaultCurrencyForLocale(defaultLocale),
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

const ACTIVE_MEMBER_STORAGE_KEY = "time-blossom:active-member:v1";
const ACTIVE_WORKSPACE_STORAGE_KEY = "time-blossom:active-workspace:v1";
const SESSION_STORAGE_KEY = "time-blossom:session:v1";
const ACCOUNT_STORAGE_KEY = "time-blossom:account:v11";
const LEGACY_ACCOUNT_KEYS = [
  "time-blossom:account:v10",
  "time-blossom:account:v9",
  "time-blossom:workspace:v8",
  "time-blossom:workspace:v7",
  "time-blossom:workspace:v6",
  "time-blossom:workspace:v5",
  `time-blossom:workspace:v4:${defaultCurrentUserId}`,
  `time-blossom:workspace:v3:${defaultCurrentUserId}`,
  `time-blossom:workspace:v2:${defaultCurrentUserId}`,
];
const TIMER_STORAGE_KEY = (memberId: string, workspaceId: string) =>
  `time-blossom:active-timer:v3:${memberId}:${workspaceId}`;
const LEGACY_TIMER_STORAGE_KEY = (memberId: string) => `time-blossom:active-timer:v2:${memberId}`;

function isValidClock(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function getInitialTimeZone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(timezone) ? timezone : "UTC";
  } catch {
    return "UTC";
  }
}

function isValidAvatarUrl(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      ((/^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=\r\n]+$/.test(value) &&
        value.length <= 1_500_000) ||
        /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/sign\/avatars\//.test(value)))
  );
}

function isValidLogoUrl(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(value) &&
      value.length <= 900_000)
  );
}

function isValidPreferences(value: unknown): value is UserPreferences {
  if (!value || typeof value !== "object") return false;
  const prefs = value as Partial<UserPreferences>;
  return (
    typeof prefs.reminders === "boolean" &&
    typeof prefs.weeklyDigest === "boolean" &&
    typeof prefs.idleDetection === "boolean" &&
    isLocale(prefs.language) &&
    isThemeMode(prefs.theme) &&
    isValidAvatarUrl(prefs.avatarUrl) &&
    isValidTimeZone(prefs.timezone) &&
    isFiniteNumber(prefs.hourlyRate) &&
    prefs.hourlyRate >= 0 &&
    isCurrencyCode(prefs.currency)
  );
}

function isValidSettings(value: unknown): value is WorkspaceSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<WorkspaceSettings>;
  return (
    typeof settings.defaultBillable === "boolean" &&
    (settings.weekStart === "monday" || settings.weekStart === "sunday")
  );
}

function isValidClient(value: unknown): value is Client {
  if (!value || typeof value !== "object") return false;
  const client = value as Partial<Client>;
  return (
    typeof client.id === "string" &&
    typeof client.name === "string" &&
    Boolean(client.name.trim()) &&
    typeof client.contact === "string"
  );
}

function isValidMember(value: unknown): value is Member {
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
    typeof member.initials === "string"
  );
}

function isValidProject(value: unknown, clients: Client[]): value is Project {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<Project>;
  return (
    typeof project.id === "string" &&
    typeof project.name === "string" &&
    Boolean(project.name.trim()) &&
    typeof project.clientId === "string" &&
    clients.some((client) => client.id === project.clientId) &&
    typeof project.billable === "boolean" &&
    (project.status === "active" ||
      project.status === "on-hold" ||
      project.status === "archived") &&
    typeof project.color === "string" &&
    typeof project.lastActivity === "string" &&
    Array.isArray(project.memberIds) &&
    project.memberIds.every((id) => typeof id === "string")
  );
}

function isValidEntry(value: unknown, projects: Project[]): value is TimeEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<TimeEntry>;
  if (
    typeof entry.id !== "string" ||
    !entry.id.trim() ||
    typeof entry.date !== "string" ||
    typeof entry.start !== "string" ||
    typeof entry.end !== "string" ||
    typeof entry.seconds !== "number" ||
    typeof entry.userId !== "string" ||
    typeof entry.task !== "string" ||
    typeof entry.billable !== "boolean"
  )
    return false;
  if (!isValidDateOnly(entry.date) || !isValidDateOnly(entry.endDate ?? entry.date)) return false;
  if (entry.endDate && entry.endDate < entry.date) return false;
  if (!isValidClock(entry.start) || !isValidClock(entry.end)) return false;
  if (entry.projectId !== null && typeof entry.projectId !== "string") return false;
  if (entry.projectId !== null && !projects.some((project) => project.id === entry.projectId))
    return false;
  if (!entry.task.trim() || !isFiniteNumber(entry.seconds) || entry.seconds <= 0) return false;
  if (entry.startTimestamp !== undefined && !isFiniteNumber(entry.startTimestamp)) return false;
  if (entry.endTimestamp !== undefined && !isFiniteNumber(entry.endTimestamp)) return false;
  if ((entry.startTimestamp === undefined) !== (entry.endTimestamp === undefined)) return false;
  if (entry.startTimestamp !== undefined && entry.endTimestamp! < entry.startTimestamp)
    return false;
  if (entry.hourlyRate !== undefined && (!isFiniteNumber(entry.hourlyRate) || entry.hourlyRate < 0))
    return false;
  if (entry.currency !== undefined && !isCurrencyCode(entry.currency)) return false;
  const calculated = getElapsedSeconds(entry as TimeEntry);
  return calculated > 0 && Math.abs(calculated - entry.seconds) <= 1;
}

function membershipToMember(
  membership: WorkspaceMembership,
  identities: UserIdentity[],
): Member | null {
  const identity = identities.find((candidate) => candidate.id === membership.userId);
  if (!identity) return null;
  return {
    ...identity,
    role: membership.role,
    status: membership.status,
    ...(membership.invitedAt ? { invitedAt: membership.invitedAt } : {}),
  };
}

function membersToMemberships(workspaceId: string, members: Member[]): WorkspaceMembership[] {
  return members.map((member) => ({
    workspaceId,
    userId: member.id,
    role: member.role,
    status: member.status,
    ...(member.invitedAt ? { invitedAt: member.invitedAt } : {}),
  }));
}

function createIdentity(member: Member): UserIdentity {
  return { id: member.id, name: member.name, email: member.email, initials: member.initials };
}

function normalizeLegacyAccount(value: unknown): PersistedAccount | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    !Array.isArray(raw["entries"]) ||
    !Array.isArray(raw["projects"]) ||
    !Array.isArray(raw["clients"])
  )
    return null;
  const legacySettings = raw["settings"] as Record<string, unknown> | undefined;
  if (
    !legacySettings ||
    typeof legacySettings["defaultBillable"] !== "boolean" ||
    (legacySettings["weekStart"] !== "monday" && legacySettings["weekStart"] !== "sunday")
  )
    return null;
  const clients = raw["clients"].filter(isValidClient) as Client[];
  if (clients.length !== raw["clients"].length) return null;
  const projects = raw["projects"]
    .map((candidate) => {
      if (!candidate || typeof candidate !== "object") return null;
      const project = candidate as Record<string, unknown>;
      const normalized = {
        ...project,
        billable:
          typeof project["billable"] === "boolean"
            ? project["billable"]
            : legacySettings["defaultBillable"],
      };
      return isValidProject(normalized, clients) ? (normalized as Project) : null;
    })
    .filter((project): project is Project => project !== null);
  if (projects.length !== raw["projects"].length) return null;
  const entries = raw["entries"].filter((entry) => isValidEntry(entry, projects)) as TimeEntry[];
  if (entries.length !== raw["entries"].length) return null;
  const legacyMembers = raw["members"];
  const members =
    Array.isArray(legacyMembers) && legacyMembers.every(isValidMember)
      ? (legacyMembers as Member[])
      : seedMembers;
  const workspaceId = "w1";
  const owner = members.find((member) => member.role === "Owner") ?? members[0];
  const workspaceName =
    typeof legacySettings["workspaceName"] === "string" && legacySettings["workspaceName"].trim()
      ? legacySettings["workspaceName"].trim()
      : "Studio Co.";
  const identities = members.map(createIdentity);
  const preferencesByUserId: Record<string, UserPreferences> = {};
  const legacyPreferences = raw["preferencesByMemberId"];
  for (const member of members) {
    const candidate =
      legacyPreferences && typeof legacyPreferences === "object"
        ? (legacyPreferences as Record<string, unknown>)[member.id]
        : null;
    const legacy = candidate as Partial<UserPreferences> | null;
    preferencesByUserId[member.id] =
      legacy &&
      typeof legacy.reminders === "boolean" &&
      typeof legacy.weeklyDigest === "boolean" &&
      typeof legacy.idleDetection === "boolean" &&
      isLocale(legacy.language) &&
      isThemeMode(legacy.theme) &&
      isValidAvatarUrl(legacy.avatarUrl)
        ? {
            reminders: legacy.reminders,
            weeklyDigest: legacy.weeklyDigest,
            idleDetection: legacy.idleDetection,
            language: legacy.language,
            theme: legacy.theme,
            avatarUrl: legacy.avatarUrl,
            timezone: isValidTimeZone(legacy.timezone) ? legacy.timezone : getInitialTimeZone(),
            hourlyRate:
              isFiniteNumber(legacy.hourlyRate) && legacy.hourlyRate >= 0 ? legacy.hourlyRate : 0,
            currency: isCurrencyCode(legacy.currency)
              ? legacy.currency
              : defaultCurrencyForLocale(legacy.language),
          }
        : { ...initialPreferences };
  }
  return {
    version: 11,
    identities,
    workspaces: [
      {
        workspace: {
          id: workspaceId,
          name: workspaceName,
          ownerId: owner?.id ?? defaultCurrentUserId,
          logoDataUrl: null,
          status: "active",
          createdAt: new Date().toISOString(),
        },
        memberships: membersToMemberships(workspaceId, members),
        entries,
        projects,
        clients,
        settings: {
          defaultBillable: legacySettings["defaultBillable"],
          weekStart: legacySettings["weekStart"],
        },
        trello: initialTrello,
      },
    ],
    preferencesByUserId,
  };
}

export function migrateAccountSnapshot(value: unknown): PersistedAccount | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as {
    version?: unknown;
    identities?: UserIdentity[];
    workspaces?: WorkspaceData[];
    preferencesByUserId?: Record<string, unknown>;
  };
  if (
    (raw.version !== 9 && raw.version !== 10) ||
    !Array.isArray(raw.identities) ||
    !Array.isArray(raw.workspaces) ||
    !raw.preferencesByUserId ||
    typeof raw.preferencesByUserId !== "object"
  )
    return null;

  const preferencesByUserId: Record<string, UserPreferences> = {};
  for (const identity of raw.identities) {
    if (!identity || typeof identity !== "object" || typeof identity.id !== "string") return null;
    const candidate = raw.preferencesByUserId[identity.id];
    if (!candidate || typeof candidate !== "object") return null;
    const preferences = candidate as Partial<UserPreferences>;
    if (
      typeof preferences.reminders !== "boolean" ||
      typeof preferences.weeklyDigest !== "boolean" ||
      typeof preferences.idleDetection !== "boolean" ||
      !isLocale(preferences.language) ||
      !isThemeMode(preferences.theme) ||
      !isValidAvatarUrl(preferences.avatarUrl)
    )
      return null;
    preferencesByUserId[identity.id] = {
      reminders: preferences.reminders,
      weeklyDigest: preferences.weeklyDigest,
      idleDetection: preferences.idleDetection,
      language: preferences.language,
      theme: preferences.theme,
      avatarUrl: preferences.avatarUrl,
      timezone: isValidTimeZone(preferences.timezone) ? preferences.timezone : getInitialTimeZone(),
      hourlyRate:
        isFiniteNumber(preferences.hourlyRate) && preferences.hourlyRate >= 0
          ? preferences.hourlyRate
          : 0,
      currency: isCurrencyCode(preferences.currency)
        ? preferences.currency
        : defaultCurrencyForLocale(preferences.language),
    };
  }

  const migrated: PersistedAccount = {
    version: 11,
    identities: raw.identities,
    workspaces: raw.workspaces,
    preferencesByUserId,
  };
  const repaired = repairDuplicateEntryIds(migrated);
  return isValidAccount(repaired) ? repaired : null;
}

/**
 * Older local snapshots could contain duplicate entry IDs because the in-memory
 * counter restarted after a full page reload. Repair only the later copies so
 * the first existing record keeps its original identity and history.
 */
export function repairDuplicateEntryIds(value: unknown): unknown {
  if (
    !isRecord(value) ||
    (value["version"] !== 10 && value["version"] !== 11) ||
    !Array.isArray(value["workspaces"])
  ) {
    return value;
  }

  const workspaces = value["workspaces"];
  if (
    !workspaces.every((workspace) => isRecord(workspace) && Array.isArray(workspace["entries"]))
  ) {
    return value;
  }

  let replacementNumber = 0;
  let changed = false;
  const repairedWorkspaces = workspaces.map((workspace) => {
    const record = workspace as Record<string, unknown>;
    const entries = record["entries"] as unknown[];
    const originalIds = new Set<string>();
    const usedIds = new Set<string>();
    for (const entry of entries) {
      if (isRecord(entry) && typeof entry["id"] === "string" && entry["id"].trim()) {
        originalIds.add(entry["id"]);
      }
    }
    let workspaceChanged = false;
    const repairedEntries = entries.map((entry) => {
      if (!isRecord(entry) || typeof entry["id"] !== "string") return entry;

      const id = entry["id"];
      if (id.trim() && !usedIds.has(id)) {
        usedIds.add(id);
        return entry;
      }

      let replacementId = "";
      do {
        replacementId = `t-migrated-${++replacementNumber}`;
      } while (originalIds.has(replacementId) || usedIds.has(replacementId));

      usedIds.add(replacementId);
      changed = true;
      workspaceChanged = true;
      return { ...entry, id: replacementId };
    });

    return workspaceChanged ? { ...record, entries: repairedEntries } : workspace;
  });

  return changed ? { ...value, workspaces: repairedWorkspaces } : value;
}

export function makeSeedAccount(): PersistedAccount {
  const identities = seedMembers.map(createIdentity);
  const defaultWorkspaceId = "w1";
  const sharedWorkspaceId = "w2";
  const defaultWorkspace: WorkspaceData = {
    workspace: {
      id: defaultWorkspaceId,
      name: "Studio Co.",
      ownerId: "u1",
      logoDataUrl: null,
      status: "active",
      createdAt: "2026-08-01T09:00:00.000Z",
    },
    memberships: membersToMemberships(defaultWorkspaceId, seedMembers),
    entries: seedEntries,
    projects: seedProjects,
    clients: seedClients,
    settings: { ...initialSettings },
    trello: initialTrello,
  };
  const sharedMembers: Member[] = [
    { ...seedMembers[1]!, role: "Owner" },
    { ...seedMembers[0]!, role: "Member" },
    { ...seedMembers[2]!, role: "Member" },
  ];
  const sharedWorkspace: WorkspaceData = {
    workspace: {
      id: sharedWorkspaceId,
      name: "Product Lab",
      ownerId: "u2",
      logoDataUrl: null,
      status: "active",
      createdAt: "2026-08-05T09:00:00.000Z",
    },
    memberships: membersToMemberships(sharedWorkspaceId, sharedMembers),
    entries: seedEntries.filter((entry) => entry.projectId === "p1"),
    projects: seedProjects.filter((project) => project.id === "p1"),
    clients: seedClients.filter((client) => client.id === "c1"),
    settings: { ...initialSettings },
    trello: initialTrello,
  };
  return {
    version: 11,
    identities,
    workspaces: [defaultWorkspace, sharedWorkspace],
    preferencesByUserId: Object.fromEntries(
      identities.map((identity) => [identity.id, { ...initialPreferences }]),
    ),
  };
}

export function isValidAccount(value: unknown): value is PersistedAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Partial<PersistedAccount>;
  if (
    account.version !== 11 ||
    !Array.isArray(account.identities) ||
    !Array.isArray(account.workspaces) ||
    !account.preferencesByUserId ||
    typeof account.preferencesByUserId !== "object"
  )
    return false;
  const identities = account.identities;
  const workspaces = account.workspaces;
  const preferencesByUserId = account.preferencesByUserId;
  const identityIds = new Set(identities.map((identity) => identity.id));
  const workspaceIds = new Set(workspaces.map((data) => data.workspace.id));
  if (
    identities.length === 0 ||
    identityIds.size !== identities.length ||
    !identities.every(
      (identity) =>
        identity &&
        typeof identity.id === "string" &&
        Boolean(identity.id.trim()) &&
        typeof identity.name === "string" &&
        Boolean(identity.name.trim()) &&
        typeof identity.email === "string" &&
        Boolean(identity.email.trim()) &&
        typeof identity.initials === "string" &&
        Boolean(identity.initials.trim()),
    ) ||
    !Object.values(preferencesByUserId).every(isValidPreferences)
  )
    return false;
  if (workspaceIds.size !== workspaces.length) return false;
  return workspaces.every((data) => {
    const entryIds = new Set<string>();
    if (!data || typeof data !== "object") return false;
    const workspace = data.workspace;
    if (
      !workspace ||
      typeof workspace.id !== "string" ||
      typeof workspace.name !== "string" ||
      !workspace.name.trim() ||
      typeof workspace.ownerId !== "string" ||
      !isValidLogoUrl(workspace.logoDataUrl) ||
      (workspace.status !== "active" && workspace.status !== "archived") ||
      typeof workspace.createdAt !== "string" ||
      Number.isNaN(Date.parse(workspace.createdAt)) ||
      (workspace.archivedAt !== undefined &&
        (typeof workspace.archivedAt !== "string" ||
          Number.isNaN(Date.parse(workspace.archivedAt)))) ||
      !identityIds.has(workspace.ownerId) ||
      !Array.isArray(data.memberships) ||
      !Array.isArray(data.clients) ||
      !Array.isArray(data.projects) ||
      !Array.isArray(data.entries) ||
      !isValidSettings(data.settings)
    )
      return false;
    if (!data.clients.every(isValidClient)) return false;
    const membershipIds = new Set(data.memberships.map((membership) => membership.userId));
    if (membershipIds.size !== data.memberships.length) return false;
    if (
      !data.memberships.every(
        (membership) =>
          membership &&
          membership.workspaceId === workspace.id &&
          typeof membership.userId === "string" &&
          identityIds.has(membership.userId) &&
          (membership.role === "Owner" ||
            membership.role === "Admin" ||
            membership.role === "Member") &&
          (membership.status === "active" ||
            membership.status === "invited" ||
            membership.status === "removed") &&
          (membership.invitedAt === undefined ||
            (typeof membership.invitedAt === "string" &&
              !Number.isNaN(Date.parse(membership.invitedAt)))) &&
          (membership.joinedAt === undefined ||
            (typeof membership.joinedAt === "string" &&
              !Number.isNaN(Date.parse(membership.joinedAt)))),
      )
    )
      return false;
    const ownerMemberships = data.memberships.filter(
      (membership) => membership.role === "Owner" && membership.userId === workspace.ownerId,
    );
    if (ownerMemberships.length !== 1) return false;
    if (
      data.memberships.some(
        (membership) => membership.role === "Owner" && membership.userId !== workspace.ownerId,
      )
    )
      return false;
    if (!data.projects.every((project) => isValidProject(project, data.clients))) return false;
    if (
      data.projects.some((project) =>
        project.memberIds.some((memberId) => !membershipIds.has(memberId)),
      )
    )
      return false;
    if (
      !data.entries.every(
        (entry) =>
          identityIds.has(entry.userId) &&
          membershipIds.has(entry.userId) &&
          isValidEntry(entry, data.projects),
      )
    )
      return false;
    for (const entry of data.entries) {
      if (entryIds.has(entry.id)) return false;
      entryIds.add(entry.id);
    }
    return true;
  });
}

function readPersistedAccount(): PersistedAccount {
  if (typeof window === "undefined") return makeSeedAccount();
  try {
    for (const key of [ACCOUNT_STORAGE_KEY, ...LEGACY_ACCOUNT_KEYS]) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      const repaired = repairDuplicateEntryIds(parsed);
      if (isValidAccount(repaired)) {
        if (repaired !== parsed)
          window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(repaired));
        return repaired;
      }
      const migrated = migrateAccountSnapshot(parsed) ?? normalizeLegacyAccount(parsed);
      const repairedMigrated = repairDuplicateEntryIds(migrated);
      if (repairedMigrated && isValidAccount(repairedMigrated)) {
        window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(repairedMigrated));
        if (key !== ACCOUNT_STORAGE_KEY) window.localStorage.removeItem(key);
        return repairedMigrated;
      }
    }
  } catch {
    // Seed fallback keeps the local prototype usable after malformed storage.
  }
  return makeSeedAccount();
}

function readActiveMemberId(identities: UserIdentity[]): string {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(ACTIVE_MEMBER_STORAGE_KEY);
      if (stored && identities.some((identity) => identity.id === stored)) return stored;
      window.localStorage.removeItem(ACTIVE_MEMBER_STORAGE_KEY);
    } catch {
      // Seed fallback.
    }
  }
  return identities.some((identity) => identity.id === defaultCurrentUserId)
    ? defaultCurrentUserId
    : (identities[0]?.id ?? defaultCurrentUserId);
}

function readActiveWorkspaceId(account: PersistedAccount, memberId: string): string {
  const accessible = account.workspaces.filter((data) =>
    data.memberships.some(
      (membership) => membership.userId === memberId && membership.status === "active",
    ),
  );
  const active = accessible.filter((data) => data.workspace.status === "active");
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
      const storedWorkspace = accessible.find((data) => data.workspace.id === stored);
      if (stored && storedWorkspace?.workspace.status === "active") return stored;
      if (stored && storedWorkspace && active.length === 0) return stored;
      window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    } catch {
      // First accessible workspace fallback.
    }
  }
  return active[0]?.workspace.id ?? accessible[0]?.workspace.id ?? "w1";
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

function isValidTimerSnapshot(
  value: unknown,
  workspaceId: string,
  projects: Project[],
): value is TimerState {
  if (!value || typeof value !== "object") return false;
  const timer = value as Partial<TimerState>;
  if (timer.status !== "running" && timer.status !== "paused") return false;
  if (timer.workspaceId !== workspaceId || typeof timer.task !== "string" || !timer.task.trim())
    return false;
  if (
    timer.projectId !== null &&
    (typeof timer.projectId !== "string" ||
      !projects.some((project) => project.id === timer.projectId))
  )
    return false;
  if (
    typeof timer.billable !== "boolean" ||
    !isValidClock(timer.startClock) ||
    typeof timer.startedDate !== "string" ||
    !isValidDateOnly(timer.startedDate) ||
    !isFiniteNumber(timer.accumulated) ||
    timer.accumulated < 0
  )
    return false;
  if (timer.hourlyRate !== undefined && (!isFiniteNumber(timer.hourlyRate) || timer.hourlyRate < 0))
    return false;
  if (timer.currency !== undefined && !isCurrencyCode(timer.currency)) return false;
  if (timer.status === "running") {
    if (!isFiniteNumber(timer.startedAt) || timer.startedAt > Date.now() + 60_000) return false;
  } else if (timer.startedAt !== null) return false;
  return true;
}

function readPersistedTimer(
  memberId: string,
  workspaceId: string,
  projects: Project[],
): TimerState {
  if (typeof window === "undefined") return initialTimer;
  try {
    const key = TIMER_STORAGE_KEY(memberId, workspaceId);
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidTimerSnapshot(parsed, workspaceId, projects)) return parsed;
      window.localStorage.removeItem(key);
    }
    const legacyRaw = window.localStorage.getItem(LEGACY_TIMER_STORAGE_KEY(memberId));
    if (legacyRaw) {
      const migrated = { ...(JSON.parse(legacyRaw) as Partial<TimerState>), workspaceId };
      if (isValidTimerSnapshot(migrated, workspaceId, projects)) {
        window.localStorage.setItem(key, JSON.stringify(migrated));
        window.localStorage.removeItem(LEGACY_TIMER_STORAGE_KEY(memberId));
        return migrated;
      }
    }
  } catch {
    try {
      window.localStorage.removeItem(TIMER_STORAGE_KEY(memberId, workspaceId));
    } catch {
      /* no-op */
    }
  }
  return initialTimer;
}

export function elapsedForTimer(timer: TimerState, now = Date.now()): number {
  if (timer.status !== "running" || timer.startedAt === null) return timer.accumulated;
  return Math.max(0, timer.accumulated + Math.floor((now - timer.startedAt) / 1000));
}

export function pauseTimerAt(timer: TimerState, effectiveAt = Date.now()): TimerState {
  if (timer.status !== "running") return timer;
  const now = Date.now();
  const requestedAt = Number.isFinite(effectiveAt) ? effectiveAt : now;
  const pauseAt = Math.max(timer.startedAt ?? requestedAt, Math.min(requestedAt, now));
  return {
    ...timer,
    status: "paused",
    accumulated: elapsedForTimer(timer, pauseAt),
    startedAt: null,
  };
}

function cloneTrello(trello: TrelloState): TrelloState {
  return { ...trello, lists: [...trello.lists], cards: [...trello.cards] };
}

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

let idCounter = 100;
const nextId = (prefix: string, existingIds: Iterable<string> = []) => {
  const usedIds = new Set(existingIds);
  let candidate = "";
  do {
    candidate = `${prefix}${++idCounter}`;
  } while (usedIds.has(candidate));
  return candidate;
};
const inviteEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface StoreValue {
  entries: TimeEntry[];
  projects: Project[];
  clients: Client[];
  members: Member[];
  timer: TimerState;
  recentTasks: TimerTaskPreset[];
  elapsed: number;
  trello: TrelloState;
  settings: WorkspaceSettings;
  preferences: UserPreferences;
  billingPreferencesByUserId: Record<string, BillingPreference>;
  currentMember: Member | null;
  currentWorkspace: Workspace | null;
  currentWorkspaceMembership: WorkspaceMembership | null;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  sessionStatus: SessionStatus;
  can: (permission: Permission) => boolean;
  canTrackProject: (projectId: string) => boolean;
  findEntryConflict: (
    entry: Omit<TimeEntry, "id">,
    excludedEntryId?: string,
  ) => TimeEntry | undefined;
  setActiveMember: (memberId: string) => StoreResult;
  currentUserId: string;
  today: string;
  startTimer: (task: string, projectId: string | null, billable?: boolean) => StoreResult;
  startTimerFromTask: (task: TimerTaskPreset) => StoreResult;
  updateTimer: (patch: {
    task?: string;
    projectId?: string | null;
    billable?: boolean;
  }) => StoreResult;
  setTimerElapsed: (seconds: number) => StoreResult;
  pauseTimer: (effectiveAt?: number) => void;
  resumeTimer: () => void;
  stopTimer: () => StoreResult;
  addEntry: (entry: Omit<TimeEntry, "id">, options?: AddEntryOptions) => StoreResult;
  updateEntry: (id: string, patch: Partial<Omit<TimeEntry, "id">>) => StoreResult;
  deleteEntry: (id: string) => StoreResult;
  restoreEntry: (entry: TimeEntry) => StoreResult;
  addProject: (project: Omit<Project, "id">) => StoreResult;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => StoreResult;
  deleteProject: (id: string) => StoreResult;
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
  updateCurrentMemberName: (name: string) => StoreResult;
  updateCurrentMemberEmail: (email: string) => StoreResult;
  switchWorkspace: (workspaceId: string) => StoreResult;
  createWorkspace: (name: string) => StoreResult;
  updateWorkspace: (
    workspaceId: string,
    patch: { name?: string; logoDataUrl?: string | null },
  ) => StoreResult;
  archiveWorkspace: (workspaceId: string) => StoreResult;
  restoreWorkspace: (workspaceId: string) => StoreResult;
  leaveWorkspace: (workspaceId: string) => StoreResult;
  signOut: () => StoreResult;
  resumeSession: (memberId: string) => StoreResult;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<PersistedAccount>(() => readPersistedAccount());
  const [activeMemberId, setActiveMemberId] = useState(() =>
    readActiveMemberId(account.identities),
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() =>
    readActiveWorkspaceId(account, readActiveMemberId(account.identities)),
  );
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(() => readSessionStatus());
  const activeData =
    account.workspaces.find((data) => data.workspace.id === activeWorkspaceId) ??
    account.workspaces[0];
  const [entries, setEntries] = useState<TimeEntry[]>(() => activeData?.entries ?? []);
  const [projects, setProjects] = useState<Project[]>(() => activeData?.projects ?? []);
  const [clients, setClients] = useState<Client[]>(() => activeData?.clients ?? []);
  const [members, setMembers] = useState<Member[]>(() =>
    (activeData?.memberships ?? [])
      .map((membership) => membershipToMember(membership, account.identities))
      .filter((member): member is Member => member !== null),
  );
  const [settings, setSettingsState] = useState<WorkspaceSettings>(
    () => activeData?.settings ?? initialSettings,
  );
  const [trello, setTrelloState] = useState<TrelloState>(() => activeData?.trello ?? initialTrello);
  const [timer, setTimer] = useState<TimerState>(() =>
    activeData
      ? readPersistedTimer(activeMemberId, activeData.workspace.id, activeData.projects)
      : initialTimer,
  );
  const [elapsed, setElapsed] = useState(() => elapsedForTimer(timer));
  const preferences = account.preferencesByUserId[activeMemberId] ?? initialPreferences;
  const billingPreferencesByUserId = useMemo(
    () =>
      Object.fromEntries(
        account.identities.map((identity) => {
          const userPreferences = account.preferencesByUserId[identity.id] ?? initialPreferences;
          return [
            identity.id,
            { hourlyRate: userPreferences.hourlyRate, currency: userPreferences.currency },
          ];
        }),
      ),
    [account.identities, account.preferencesByUserId],
  );
  const [today, setToday] = useState(() => getLocalToday(new Date(), preferences.timezone));
  const currentWorkspace = activeData?.workspace ?? null;
  const currentWorkspaceMembership =
    activeData?.memberships.find((membership) => membership.userId === activeMemberId) ?? null;
  const currentMember = members.find((member) => member.id === activeMemberId) ?? null;
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const recentTasks = useMemo(() => {
    const entriesForMember = entries.filter((entry) => entry.userId === activeMemberId);
    const recent = recentTimerTasksFromEntries(entriesForMember);
    if (timer.status === "idle" || timer.workspaceId !== activeWorkspaceId) return recent;
    return rememberRecentTimerTask(recent, timer);
  }, [activeMemberId, activeWorkspaceId, entries, timer]);

  useEffect(() => {
    try {
      if (!currentWorkspace) return;
      const key = TIMER_STORAGE_KEY(activeMemberId, currentWorkspace.id);
      if (timer.status === "idle") window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(timer));
    } catch {
      // Memory fallback.
    }
  }, [activeMemberId, currentWorkspace, timer]);

  useEffect(() => {
    const current = account.workspaces.find((data) => data.workspace.id === activeWorkspaceId);
    if (!current) return;
    const next: WorkspaceData = {
      ...current,
      entries,
      projects,
      clients,
      memberships: membersToMemberships(activeWorkspaceId, members),
      settings,
      trello,
    };
    if (
      current.entries === entries &&
      current.projects === projects &&
      current.clients === clients &&
      current.settings === settings &&
      current.trello === trello
    )
      return;
    setAccount((previous) => ({
      ...previous,
      workspaces: previous.workspaces.map((data) =>
        data.workspace.id === activeWorkspaceId ? next : data,
      ),
    }));
  }, [
    account.workspaces,
    activeWorkspaceId,
    clients,
    entries,
    members,
    projects,
    settings,
    trello,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
    } catch {
      /* Memory fallback. */
    }
  }, [account]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, activeWorkspaceId);
    } catch {
      /* Memory fallback. */
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    const refreshToday = () => setToday(getLocalToday(new Date(), preferences.timezone));
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
  }, [preferences.timezone]);

  useEffect(() => {
    const refreshElapsed = () => setElapsed(elapsedForTimer(timerRef.current));
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") refreshElapsed();
    };
    refreshElapsed();
    window.addEventListener("focus", refreshElapsed);
    document.addEventListener("visibilitychange", refreshWhenActive);
    if (timer.status !== "running")
      return () => {
        window.removeEventListener("focus", refreshElapsed);
        document.removeEventListener("visibilitychange", refreshWhenActive);
      };
    const id = window.setInterval(refreshElapsed, 1000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refreshElapsed);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [timer.status, timer.startedAt, timer.accumulated]);

  const value = useMemo<StoreValue>(() => {
    const can = (permission: Permission): boolean =>
      hasPermission(currentMember?.role ?? null, permission, {
        sessionActive: sessionStatus === "active",
        memberActive: currentMember?.status === "active",
        workspaceStatus: currentWorkspace?.status ?? "archived",
      });

    const canTrackProject = (projectId: string): boolean => {
      const project = projects.find((candidate) => candidate.id === projectId);
      return canTrackProjectForRole(currentMember?.role ?? null, activeMemberId, project ?? null, {
        sessionActive: sessionStatus === "active",
        memberActive: currentMember?.status === "active",
      });
    };

    const validateProjectId = (projectId: string | null, allowUnassigned = false): StoreResult => {
      if (projectId === null) return { success: true };
      const project = projects.find((candidate) => candidate.id === projectId);
      if (!project) return { success: false, error: "This project no longer exists." };
      if (allowUnassigned) return { success: true };
      if (project.status === "archived")
        return {
          success: false,
          error: "This project is archived and cannot be used to start a timer.",
        };
      if (project.status !== "active")
        return {
          success: false,
          error: "This project is inactive and cannot be used to start a timer.",
        };
      if (canTrackProject(projectId)) return { success: true };
      return { success: false, error: "This project is not assigned to your team member." };
    };

    const validateEntry = (
      entry: Omit<TimeEntry, "id">,
      allowExistingProjectId?: string | null,
    ): StoreResult => {
      const projectValidation = validateProjectId(
        entry.projectId,
        entry.projectId === allowExistingProjectId,
      );
      if (!projectValidation.success) return projectValidation;
      if (!entry.task.trim()) return { success: false, error: "A task is required." };
      if (!isValidDateOnly(entry.date)) return { success: false, error: "Choose a valid date." };
      if (entry.endDate && (!isValidDateOnly(entry.endDate) || entry.endDate < entry.date))
        return { success: false, error: "Choose a valid end date." };
      const endDate = getEndDateForEntry(entry);
      const calculated = getElapsedSeconds({ ...entry, endDate });
      if (calculated <= 0 || entry.seconds <= 0)
        return { success: false, error: "End time must be after start time." };
      if (Math.abs(calculated - entry.seconds) > 1)
        return { success: false, error: "Duration must match the selected time range." };
      return { success: true };
    };

    const findEntryConflict = (
      entry: Omit<TimeEntry, "id">,
      excludedEntryId?: string,
    ): TimeEntry | undefined =>
      findTimeEntryConflict(
        { ...entry, workspaceId: activeWorkspaceId },
        entries.map((existing): ScopedTimeIntervalEntry & TimeEntry => ({
          ...existing,
          workspaceId: activeWorkspaceId,
        })),
        {
          ...(excludedEntryId ? { excludeEntryId: excludedEntryId } : {}),
          timeZone: preferences.timezone,
        },
      );

    const startTimer = (
      task: string,
      projectId: string | null,
      billable?: boolean,
    ): StoreResult => {
      if (!can("track-own-time"))
        return { success: false, error: "Your account cannot track time." };
      if (timerRef.current.status !== "idle")
        return { success: false, error: "Stop the active timer before starting another one." };
      const projectValidation = validateProjectId(projectId);
      if (!projectValidation.success) return projectValidation;
      const projectDefault =
        projectId === null
          ? settings.defaultBillable
          : (projects.find((project) => project.id === projectId)?.billable ??
            settings.defaultBillable);
      const now = Date.now();
      const next = createRunningTimer(
        { task, projectId, billable: billable ?? projectDefault },
        {
          workspaceId: activeWorkspaceId,
          now,
          startedDate: getLocalToday(new Date(now), preferences.timezone),
          startClock: nowTime(preferences.timezone),
          hourlyRate: preferences.hourlyRate,
          currency: preferences.currency,
        },
      );
      timerRef.current = next;
      setElapsed(0);
      setTimer(next);
      return { success: true };
    };

    const startTimerFromTask = (task: TimerTaskPreset): StoreResult => {
      const validation = validateTimerTaskStart(task, {
        timerStatus: timerRef.current.status,
        projects,
        canUseProject: canTrackProject,
      });
      if (!validation.success) return validation;
      return startTimer(
        validation.preset.task,
        validation.preset.projectId,
        validation.preset.billable,
      );
    };

    const updateTimer = (patch: {
      task?: string;
      projectId?: string | null;
      billable?: boolean;
    }): StoreResult => {
      if (!can("track-own-time"))
        return { success: false, error: "Your account cannot update the active timer." };
      const current = timerRef.current;
      if (current.status === "idle")
        return { success: false, error: "There is no active timer to update." };
      if (patch.projectId !== undefined) {
        const projectValidation = validateProjectId(patch.projectId);
        if (!projectValidation.success) return projectValidation;
      }
      if (patch.task !== undefined && !patch.task.trim())
        return { success: false, error: "A task is required." };
      const next = {
        ...current,
        ...patch,
        ...(patch.task !== undefined ? { task: patch.task.trim() } : {}),
      };
      timerRef.current = next;
      setTimer(next);
      return { success: true };
    };

    const setTimerElapsed = (seconds: number): StoreResult => {
      if (!can("track-own-time"))
        return { success: false, error: "Your account cannot update the active timer." };
      const current = timerRef.current;
      if (current.status === "idle")
        return { success: false, error: "There is no active timer to update." };
      if (!Number.isFinite(seconds) || seconds < 0)
        return { success: false, error: "Enter a valid timer duration." };

      const nextElapsed = Math.floor(seconds);
      const next = {
        ...current,
        accumulated: nextElapsed,
        startedAt: current.status === "running" ? Date.now() : null,
      };
      timerRef.current = next;
      setElapsed(nextElapsed);
      setTimer(next);
      return { success: true };
    };

    const pauseTimer = (effectiveAt?: number) => {
      const current = timerRef.current;
      if (current.status !== "running") return;
      const next = pauseTimerAt(current, effectiveAt);
      timerRef.current = next;
      setElapsed(next.accumulated);
      setTimer(next);
    };

    const resumeTimer = () => {
      const current = timerRef.current;
      if (current.status !== "paused" || current.workspaceId !== activeWorkspaceId) return;
      const next = { ...current, status: "running" as const, startedAt: Date.now() };
      timerRef.current = next;
      setTimer(next);
    };

    const stopTimer = (): StoreResult => {
      const current = timerRef.current;
      if (current.status === "idle" || current.workspaceId !== activeWorkspaceId)
        return { success: false, error: "There is no active timer to stop." };
      const total = elapsedForTimer(current);
      const startedDate = current.startedDate ?? getLocalToday(new Date(), preferences.timezone);
      const finish = addSecondsToDateTime(startedDate, current.startClock, total);
      let warning: string | undefined;
      let conflict: TimeEntry | undefined;
      if (total > 0) {
        const startTimestamp = dateTimeToTimestamp(
          startedDate,
          current.startClock,
          0,
          preferences.timezone,
        );
        const endTimestamp = startTimestamp === null ? null : startTimestamp + total * 1000;
        const stoppedEntry: Omit<TimeEntry, "id"> = {
          date: startedDate,
          start: current.startClock,
          end: finish.end,
          ...(finish.endDate !== startedDate ? { endDate: finish.endDate } : {}),
          ...(startTimestamp !== null ? { startTimestamp } : {}),
          ...(endTimestamp !== null ? { endTimestamp } : {}),
          seconds: total,
          userId: activeMemberId,
          projectId: current.projectId,
          task: current.task,
          billable: current.billable,
          hourlyRate: current.hourlyRate ?? preferences.hourlyRate,
          currency: current.currency ?? preferences.currency,
        };
        conflict = findEntryConflict(stoppedEntry);
        warning = conflict ? "This time overlaps another entry. It was saved anyway." : undefined;
        setEntries((list) => [
          {
            ...stoppedEntry,
            id: nextId(
              "t",
              list.map((entry) => entry.id),
            ),
          },
          ...list,
        ]);
      }
      timerRef.current = initialTimer;
      setTimer(initialTimer);
      setElapsed(0);
      return {
        success: true,
        ...(warning && conflict ? { warning, conflict } : {}),
      };
    };

    const addEntry = (entry: Omit<TimeEntry, "id">, options: AddEntryOptions = {}): StoreResult => {
      if (!can("manage-own-entries") || entry.userId !== activeMemberId)
        return { success: false, error: "You can only create your own time entries." };
      if (!options.allowWhileTimerActive && timerRef.current.status !== "idle")
        return { success: false, error: "Stop the active timer before adding time manually." };
      const billedEntry = {
        ...entry,
        hourlyRate:
          options.refreshBilling || entry.hourlyRate === undefined
            ? preferences.hourlyRate
            : entry.hourlyRate,
        currency:
          options.refreshBilling || entry.currency === undefined
            ? preferences.currency
            : entry.currency,
      } satisfies Omit<TimeEntry, "id">;
      const validation = validateEntry(billedEntry);
      if (!validation.success) return validation;
      const conflict = findEntryConflict(billedEntry);
      const warning = conflict
        ? "This time overlaps another entry. It was saved anyway."
        : undefined;
      setEntries((list) => [
        {
          ...billedEntry,
          id: nextId(
            "t",
            list.map((current) => current.id),
          ),
        },
        ...list,
      ]);
      return {
        success: true,
        ...(warning && conflict ? { warning, conflict } : {}),
      };
    };

    const updateEntry = (id: string, patch: Partial<Omit<TimeEntry, "id">>): StoreResult => {
      const current = entries.find((entry) => entry.id === id);
      if (!current) return { success: false, error: "This time entry no longer exists." };
      if (!can("manage-own-entries") || current.userId !== activeMemberId)
        return { success: false, error: "You can only edit your own time entries." };
      if (patch.userId !== undefined && patch.userId !== current.userId)
        return { success: false, error: "A time entry owner cannot be changed." };
      const next = { ...current, ...patch };
      const timeChanged = ["date", "start", "end", "endDate", "seconds"].some(
        (field) => field in patch,
      );
      if (timeChanged && !("startTimestamp" in patch) && !("endTimestamp" in patch)) {
        const onlyDateChanged =
          "date" in patch &&
          !["start", "end", "endDate", "seconds"].some((field) => field in patch);
        const startTimestamp =
          onlyDateChanged && typeof current.startTimestamp === "number"
            ? dateTimeToTimestamp(next.date, next.start, 0, preferences.timezone)
            : null;
        if (startTimestamp !== null) {
          next.startTimestamp = startTimestamp;
          next.endTimestamp = startTimestamp + next.seconds * 1000;
        } else {
          delete next.startTimestamp;
          delete next.endTimestamp;
        }
      }
      const validation = validateEntry(next, current.projectId);
      if (!validation.success) return validation;
      const conflict = timeChanged ? findEntryConflict(next, id) : undefined;
      const warning = conflict
        ? "This time overlaps another entry. It was saved anyway."
        : undefined;
      setEntries((list) => list.map((entry) => (entry.id === id ? next : entry)));
      return {
        success: true,
        ...(warning && conflict ? { warning, conflict } : {}),
      };
    };

    const deleteEntry = (id: string): StoreResult => {
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry) return { success: false, error: "This time entry no longer exists." };
      if (!can("manage-own-entries") || entry.userId !== activeMemberId)
        return { success: false, error: "You can only delete your own time entries." };
      setEntries((list) => list.filter((candidate) => candidate.id !== id));
      return { success: true };
    };

    const restoreEntry = (entry: TimeEntry): StoreResult => {
      if (!can("manage-own-entries") || entry.userId !== activeMemberId)
        return { success: false, error: "You can only restore your own time entries." };
      if (entries.some((candidate) => candidate.id === entry.id))
        return { success: false, error: "This time entry already exists." };
      const validation = validateEntry(entry);
      if (!validation.success) return validation;
      const conflict = findEntryConflict(entry);
      const warning = conflict
        ? "This time overlaps another entry. It was saved anyway."
        : undefined;
      setEntries((list) => [entry, ...list]);
      return {
        success: true,
        ...(warning && conflict ? { warning, conflict } : {}),
      };
    };

    const addProject = (project: Omit<Project, "id">): StoreResult => {
      if (!can("manage-projects"))
        return { success: false, error: "Only Admins and the Owner can manage projects." };
      if (!project.name.trim()) return { success: false, error: "A project name is required." };
      if (!clients.some((client) => client.id === project.clientId))
        return { success: false, error: "Choose an existing client for this project." };
      if (typeof project.billable !== "boolean")
        return { success: false, error: "Choose whether this project is billable." };
      if (!can("manage-project-members"))
        return { success: false, error: "You cannot assign members to projects." };
      if (
        project.memberIds.some(
          (memberId) =>
            !members.some((member) => member.id === memberId && member.status === "active"),
        )
      )
        return { success: false, error: "Only active members can be assigned to a project." };
      setProjects((list) => [
        {
          ...project,
          name: project.name.trim(),
          memberIds: [...new Set([...project.memberIds, activeMemberId])],
          id: nextId(
            "p",
            list.map((current) => current.id),
          ),
        },
        ...list,
      ]);
      return { success: true };
    };

    const updateProject = (id: string, patch: Partial<Omit<Project, "id">>): StoreResult => {
      if (!can("manage-projects"))
        return { success: false, error: "Only Admins and the Owner can manage projects." };
      const current = projects.find((project) => project.id === id);
      if (!current) return { success: false, error: "This project no longer exists." };
      const next = { ...current, ...patch, name: (patch.name ?? current.name).trim() };
      if (!next.name) return { success: false, error: "A project name is required." };
      if (!clients.some((client) => client.id === next.clientId))
        return { success: false, error: "A project must keep a valid client." };
      if (typeof next.billable !== "boolean")
        return { success: false, error: "Choose whether this project is billable." };
      if ("memberIds" in patch && !can("manage-project-members"))
        return { success: false, error: "You cannot assign members to projects." };
      if (
        next.memberIds.some(
          (memberId) =>
            !members.some((member) => member.id === memberId && member.status === "active"),
        )
      )
        return { success: false, error: "Only active members can be assigned to a project." };
      setProjects((list) => list.map((project) => (project.id === id ? next : project)));
      return { success: true };
    };

    const deleteProject = (id: string): StoreResult => {
      if (!can("manage-projects"))
        return { success: false, error: "Only Admins and the Owner can manage projects." };
      const current = projects.find((project) => project.id === id);
      if (!current) return { success: false, error: "This project no longer exists." };
      if (current.status !== "archived")
        return { success: false, error: "Archive the project before deleting it." };
      if (entries.some((entry) => entry.projectId === id))
        return {
          success: false,
          error: "This project has tracked time. Keep it archived to preserve reports and history.",
        };
      if (timerRef.current.status !== "idle")
        return { success: false, error: "Stop the active timer before deleting a project." };
      setProjects((list) => list.filter((project) => project.id !== id));
      return { success: true };
    };

    const addClient = (client: Omit<Client, "id">): StoreResult => {
      if (!can("manage-clients"))
        return { success: false, error: "Only Admins and the Owner can manage clients." };
      if (!client.name.trim()) return { success: false, error: "A client name is required." };
      setClients((list) => [
        {
          id: nextId(
            "c",
            list.map((current) => current.id),
          ),
          name: client.name.trim(),
          contact: client.contact.trim(),
        },
        ...list,
      ]);
      return { success: true };
    };

    const updateClient = (id: string, patch: Partial<Client>): StoreResult => {
      if (!can("manage-clients"))
        return { success: false, error: "Only Admins and the Owner can manage clients." };
      const current = clients.find((client) => client.id === id);
      if (!current) return { success: false, error: "This client no longer exists." };
      const next = {
        ...current,
        ...patch,
        name: (patch.name ?? current.name).trim(),
        contact: (patch.contact ?? current.contact).trim(),
      };
      if (!next.name) return { success: false, error: "A client name is required." };
      setClients((list) => list.map((client) => (client.id === id ? next : client)));
      return { success: true };
    };

    const deleteClient = (id: string): StoreResult => {
      if (!can("manage-clients"))
        return { success: false, error: "Only Admins and the Owner can manage clients." };
      const current = clients.find((client) => client.id === id);
      if (!current) return { success: false, error: "This client no longer exists." };
      const linkedProjects = projects.filter((project) => project.clientId === id);
      if (linkedProjects.length > 0)
        return {
          success: false,
          error: `This client is used by ${linkedProjects.length} project${linkedProjects.length === 1 ? "" : "s"}. Remove or reassign those projects first.`,
        };
      setClients((list) => list.filter((client) => client.id !== id));
      return { success: true };
    };

    const inviteMember = (email: string, role: Exclude<Role, "Owner">): StoreResult => {
      if (!can("manage-members"))
        return { success: false, error: "Only Admins and the Owner can invite members." };
      const normalizedEmail = email.trim().toLowerCase();
      if (!inviteEmailPattern.test(normalizedEmail))
        return { success: false, error: "Enter a valid email address." };
      if (role !== "Admin" && role !== "Member")
        return { success: false, error: "Choose a valid role for this invitation." };
      if (role === "Admin" && !can("manage-admins"))
        return { success: false, error: "Only the Owner can invite Admins." };
      if (members.filter((member) => member.status !== "removed").length >= 50)
        return {
          success: false,
          error: "This workspace has reached its limit of 50 members and invitations.",
        };
      if (members.some((member) => member.email.toLowerCase() === normalizedEmail))
        return {
          success: false,
          error: "This email is already part of the team or has a pending invitation.",
        };
      const existingIdentity = account.identities.find(
        (identity) => identity.email.toLowerCase() === normalizedEmail,
      );
      const identity = existingIdentity ?? {
        id: nextId(
          "u",
          account.identities.map((current) => current.id),
        ),
        name: displayNameFromInviteEmail(normalizedEmail),
        email: normalizedEmail,
        initials: initialsFromName(displayNameFromInviteEmail(normalizedEmail)),
      };
      const invitation: Member = {
        ...identity,
        role,
        status: existingIdentity ? "active" : "invited",
        ...(existingIdentity ? {} : { invitedAt: new Date().toISOString() }),
      };
      setMembers((list) => [invitation, ...list]);
      if (!existingIdentity)
        setAccount((current) => ({
          ...current,
          identities: [...current.identities, identity],
          preferencesByUserId: {
            ...current.preferencesByUserId,
            [identity.id]: { ...initialPreferences },
          },
        }));
      return { success: true };
    };

    const resendInvite = (memberId: string): StoreResult => {
      if (!can("manage-members"))
        return { success: false, error: "Only Admins and the Owner can manage invitations." };
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member || member.status !== "invited")
        return { success: false, error: "Only pending invitations can be resent." };
      if (member.role === "Admin" && !can("manage-admins"))
        return { success: false, error: "Only the Owner can manage Admin invitations." };
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
      if (!can("manage-members"))
        return { success: false, error: "Only Admins and the Owner can manage invitations." };
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member || member.status !== "invited")
        return { success: false, error: "Only pending invitations can be canceled." };
      if (member.role === "Admin" && !can("manage-admins"))
        return { success: false, error: "Only the Owner can manage Admin invitations." };
      setMembers((list) => list.filter((candidate) => candidate.id !== memberId));
      return { success: true };
    };

    const removeMember = (memberId: string): StoreResult => {
      if (!can("manage-members"))
        return { success: false, error: "Only Admins and the Owner can remove members." };
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member) return { success: false, error: "This team member no longer exists." };
      if (memberId === activeMemberId && currentMember?.role === "Owner")
        return { success: false, error: "The Owner cannot remove their own account." };
      if (member.status !== "active")
        return { success: false, error: "Only active members can be removed." };
      if (member.role === "Owner")
        return { success: false, error: "The workspace owner cannot be removed." };
      if (member.role === "Admin" && !can("manage-admins"))
        return { success: false, error: "Only the Owner can remove Admins." };
      const activeAdmins = members.filter(
        (candidate) => candidate.status === "active" && candidate.role === "Admin",
      );
      if (member.role === "Admin" && activeAdmins.length <= 1)
        return { success: false, error: "The last admin cannot be removed." };
      setMembers((list) =>
        list.map((candidate) =>
          candidate.id === memberId ? { ...candidate, status: "removed" } : candidate,
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
      if (!can("manage-members"))
        return { success: false, error: "Only Admins and the Owner can restore members." };
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member || member.status !== "removed")
        return { success: false, error: "Only removed members can be restored." };
      if (member.role === "Admin" && !can("manage-admins"))
        return { success: false, error: "Only the Owner can restore Admins." };
      setMembers((list) =>
        list.map((candidate) =>
          candidate.id === memberId ? { ...candidate, status: "active" } : candidate,
        ),
      );
      return { success: true };
    };

    const updateMemberRole = (memberId: string, role: Exclude<Role, "Owner">): StoreResult => {
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member) return { success: false, error: "This team member no longer exists." };
      if (memberId === activeMemberId && currentMember?.role === "Owner")
        return { success: false, error: "The Owner cannot change their own role." };
      if (member.role === "Owner")
        return { success: false, error: "The workspace owner role cannot be changed." };
      if (role !== "Admin" && role !== "Member")
        return { success: false, error: "Choose a valid team role." };
      if (currentMember?.role === "Admin" && member.role !== "Member")
        return { success: false, error: "Admins can only manage Members." };
      if (!can("manage-members"))
        return { success: false, error: "Only Admins and the Owner can change roles." };
      if (member.role === "Admin" && role === "Member") {
        if (!can("manage-admins"))
          return { success: false, error: "Only the Owner can reassign Admin roles." };
        if (
          members.filter((candidate) => candidate.status === "active" && candidate.role === "Admin")
            .length <= 1
        )
          return { success: false, error: "The last admin cannot be reassigned." };
      }
      setMembers((list) =>
        list.map((candidate) => (candidate.id === memberId ? { ...candidate, role } : candidate)),
      );
      return { success: true };
    };

    const setTrello = (patch: Partial<TrelloState>): StoreResult => {
      if (!can("manage-integrations"))
        return { success: false, error: "Only Admins and the Owner can manage integrations." };
      setTrelloState((current) => ({ ...current, ...patch }));
      return { success: true };
    };

    const setWorkspaceSettings = (patch: Partial<WorkspaceSettings>): StoreResult => {
      if (!can("manage-workspace-settings"))
        return {
          success: false,
          error: "Only Admins and the Owner can change workspace settings.",
        };
      const next = { ...settings, ...patch };
      if (typeof next.defaultBillable !== "boolean")
        return { success: false, error: "Choose a valid default billability setting." };
      if (next.weekStart !== "monday" && next.weekStart !== "sunday")
        return { success: false, error: "Choose a valid week start." };
      setSettingsState(next);
      return { success: true };
    };

    const setUserPreferences = (patch: Partial<UserPreferences>): StoreResult => {
      if (sessionStatus !== "active" || !currentMember || currentMember.status !== "active")
        return { success: false, error: "Choose an active account." };
      const next = { ...preferences, ...patch };
      if (
        typeof next.reminders !== "boolean" ||
        typeof next.weeklyDigest !== "boolean" ||
        typeof next.idleDetection !== "boolean" ||
        !isLocale(next.language) ||
        !isThemeMode(next.theme) ||
        !isValidAvatarUrl(next.avatarUrl) ||
        !isValidTimeZone(next.timezone) ||
        !isFiniteNumber(next.hourlyRate) ||
        next.hourlyRate < 0 ||
        !isCurrencyCode(next.currency)
      )
        return { success: false, error: "Choose valid personal preferences." };
      setAccount((current) => ({
        ...current,
        preferencesByUserId: { ...current.preferencesByUserId, [activeMemberId]: next },
      }));
      return { success: true };
    };

    const updateCurrentMemberEmail = (email: string): StoreResult => {
      if (!currentMember || currentMember.status !== "active")
        return { success: false, error: "Choose an active account." };
      const normalizedEmail = email.trim().toLowerCase();
      if (!inviteEmailPattern.test(normalizedEmail))
        return { success: false, error: "Enter a valid email address." };
      if (
        members.some(
          (member) =>
            member.id !== activeMemberId && member.email.toLowerCase() === normalizedEmail,
        )
      )
        return { success: false, error: "This email is already part of the team." };
      setAccount((current) => ({
        ...current,
        identities: current.identities.map((identity) =>
          identity.id === activeMemberId ? { ...identity, email: normalizedEmail } : identity,
        ),
      }));
      setMembers((list) =>
        list.map((member) =>
          member.id === activeMemberId ? { ...member, email: normalizedEmail } : member,
        ),
      );
      return { success: true };
    };

    const updateCurrentMemberName = (name: string): StoreResult => {
      if (!currentMember || currentMember.status !== "active")
        return { success: false, error: "Choose an active account." };
      const normalizedName = name.trim().replace(/\s+/g, " ");
      if (!normalizedName) return { success: false, error: "A name is required." };
      if (normalizedName.split(" ").length < 2)
        return { success: false, error: "Enter your first and last name." };
      if (normalizedName.length > 120)
        return { success: false, error: "Name must be 120 characters or fewer." };
      const initials = initialsFromName(normalizedName);
      setAccount((current) => ({
        ...current,
        identities: current.identities.map((identity) =>
          identity.id === activeMemberId
            ? { ...identity, name: normalizedName, initials }
            : identity,
        ),
      }));
      setMembers((list) =>
        list.map((member) =>
          member.id === activeMemberId ? { ...member, name: normalizedName, initials } : member,
        ),
      );
      return { success: true };
    };

    const switchWorkspace = (workspaceId: string): StoreResult => {
      if (workspaceId === activeWorkspaceId) return { success: true };
      const target = account.workspaces.find((data) => data.workspace.id === workspaceId);
      if (!target) return { success: false, error: "This workspace could not be found." };
      if (target.workspace.status === "archived")
        return { success: false, error: "Archived workspaces are read-only. Restore it first." };
      const membership = target.memberships.find(
        (candidate) => candidate.userId === activeMemberId,
      );
      if (!membership || membership.status !== "active")
        return { success: false, error: "You do not have access to this workspace." };
      if (timerRef.current.status === "running")
        return { success: false, error: "Pause the active timer before switching workspaces." };
      const current = account.workspaces.find((data) => data.workspace.id === activeWorkspaceId);
      if (current) {
        const currentSnapshot: WorkspaceData = {
          ...current,
          entries,
          projects,
          clients,
          memberships: membersToMemberships(activeWorkspaceId, members),
          settings,
          trello,
        };
        setAccount((previous) => ({
          ...previous,
          workspaces: previous.workspaces.map((data) =>
            data.workspace.id === activeWorkspaceId ? currentSnapshot : data,
          ),
        }));
      }
      setActiveWorkspaceId(workspaceId);
      setEntries(target.entries);
      setProjects(target.projects);
      setClients(target.clients);
      setMembers(
        target.memberships
          .map((item) => membershipToMember(item, account.identities))
          .filter((member): member is Member => member !== null),
      );
      setSettingsState(target.settings);
      setTrelloState(target.trello);
      const nextTimer = readPersistedTimer(activeMemberId, workspaceId, target.projects);
      timerRef.current = nextTimer;
      setTimer(nextTimer);
      setElapsed(elapsedForTimer(nextTimer));
      return { success: true };
    };

    const createWorkspace = (name: string): StoreResult => {
      if (sessionStatus !== "active" || !currentMember || currentMember.status !== "active")
        return { success: false, error: "Choose an active account." };
      if (timerRef.current.status !== "idle")
        return {
          success: false,
          error: "Pause or stop the active timer before creating a workspace.",
        };
      if (
        account.workspaces.filter((data) => data.workspace.ownerId === activeMemberId).length >= 5
      )
        return { success: false, error: "You can create up to 5 workspaces." };
      const trimmedName = name.trim();
      if (!trimmedName) return { success: false, error: "A workspace name is required." };
      if (
        account.workspaces.some(
          (data) => data.workspace.name.toLowerCase() === trimmedName.toLowerCase(),
        )
      )
        return { success: false, error: "A workspace with this name already exists." };
      const id = nextId(
        "w",
        account.workspaces.map((data) => data.workspace.id),
      );
      const workspace: WorkspaceData = {
        workspace: {
          id,
          name: trimmedName,
          ownerId: activeMemberId,
          logoDataUrl: null,
          status: "active",
          createdAt: new Date().toISOString(),
        },
        memberships: [
          {
            workspaceId: id,
            userId: activeMemberId,
            role: "Owner",
            status: "active",
            joinedAt: new Date().toISOString(),
          },
        ],
        entries: [],
        projects: [],
        clients: [],
        settings: { ...initialSettings },
        trello: cloneTrello(initialTrello),
      };
      const current = account.workspaces.find((data) => data.workspace.id === activeWorkspaceId);
      setAccount((previous) => ({
        ...previous,
        workspaces: [
          ...previous.workspaces.map((data) =>
            data.workspace.id === activeWorkspaceId && current
              ? {
                  ...current,
                  entries,
                  projects,
                  clients,
                  memberships: membersToMemberships(activeWorkspaceId, members),
                  settings,
                  trello,
                }
              : data,
          ),
          workspace,
        ],
      }));
      setActiveWorkspaceId(id);
      setEntries([]);
      setProjects([]);
      setClients([]);
      setMembers([{ ...currentMember, role: "Owner", status: "active" }]);
      setSettingsState({ ...initialSettings });
      setTrelloState(cloneTrello(initialTrello));
      return { success: true, id };
    };

    const updateWorkspace = (
      workspaceId: string,
      patch: { name?: string; logoDataUrl?: string | null },
    ): StoreResult => {
      const target = account.workspaces.find((data) => data.workspace.id === workspaceId);
      if (!target) return { success: false, error: "This workspace could not be found." };
      const membership = target.memberships.find((item) => item.userId === activeMemberId);
      if (!membership || membership.role !== "Owner" || membership.status !== "active")
        return { success: false, error: "Only the workspace Owner can edit it." };
      if (target.workspace.status === "archived")
        return { success: false, error: "Archived workspaces are read-only. Restore it first." };
      const name = patch.name === undefined ? target.workspace.name : patch.name.trim();
      if (!name) return { success: false, error: "A workspace name is required." };
      if (patch.logoDataUrl !== undefined && !isValidLogoUrl(patch.logoDataUrl))
        return { success: false, error: "Choose a PNG, JPG or WebP logo smaller than 500 KB." };
      setAccount((current) => ({
        ...current,
        workspaces: current.workspaces.map((data) =>
          data.workspace.id === workspaceId
            ? {
                ...data,
                workspace: {
                  ...data.workspace,
                  name,
                  ...(patch.logoDataUrl !== undefined ? { logoDataUrl: patch.logoDataUrl } : {}),
                },
              }
            : data,
        ),
      }));
      return { success: true };
    };

    const archiveWorkspace = (workspaceId: string): StoreResult => {
      const target = account.workspaces.find((data) => data.workspace.id === workspaceId);
      if (!target) return { success: false, error: "This workspace could not be found." };
      const membership = target.memberships.find((item) => item.userId === activeMemberId);
      if (!membership || membership.role !== "Owner" || membership.status !== "active")
        return { success: false, error: "Only the workspace Owner can archive it." };
      if (target.workspace.status === "archived")
        return { success: false, error: "This workspace is already archived." };
      if (timerRef.current.status !== "idle")
        return {
          success: false,
          error: "Pause or stop the active timer before archiving a workspace.",
        };

      const isCurrentWorkspace = workspaceId === activeWorkspaceId;
      const nextWorkspace = isCurrentWorkspace
        ? (account.workspaces.find(
            (data) =>
              data.workspace.id !== workspaceId &&
              data.workspace.status === "active" &&
              data.memberships.some(
                (item) => item.userId === activeMemberId && item.status === "active",
              ),
          ) ?? null)
        : null;
      if (isCurrentWorkspace && !nextWorkspace)
        return {
          success: false,
          error: "Keep at least one active workspace before archiving the current one.",
        };

      const currentSnapshot: WorkspaceData | null = isCurrentWorkspace
        ? {
            ...target,
            entries,
            projects,
            clients,
            memberships: membersToMemberships(activeWorkspaceId, members),
            settings,
            trello,
          }
        : null;
      const archivedAt = new Date().toISOString();
      setAccount((current) => ({
        ...current,
        workspaces: current.workspaces.map((data) => {
          if (data.workspace.id !== workspaceId) return data;
          const source = currentSnapshot ?? data;
          return {
            ...source,
            workspace: {
              ...source.workspace,
              status: "archived",
              archivedAt,
            },
          };
        }),
      }));

      if (nextWorkspace) {
        setActiveWorkspaceId(nextWorkspace.workspace.id);
        setEntries(nextWorkspace.entries);
        setProjects(nextWorkspace.projects);
        setClients(nextWorkspace.clients);
        setMembers(
          nextWorkspace.memberships
            .map((item) => membershipToMember(item, account.identities))
            .filter((member): member is Member => member !== null),
        );
        setSettingsState(nextWorkspace.settings);
        setTrelloState(nextWorkspace.trello);
        const nextTimer = readPersistedTimer(
          activeMemberId,
          nextWorkspace.workspace.id,
          nextWorkspace.projects,
        );
        timerRef.current = nextTimer;
        setTimer(nextTimer);
        setElapsed(elapsedForTimer(nextTimer));
      }
      return { success: true };
    };

    const restoreWorkspace = (workspaceId: string): StoreResult => {
      const target = account.workspaces.find((data) => data.workspace.id === workspaceId);
      if (!target) return { success: false, error: "This workspace could not be found." };
      const membership = target.memberships.find((item) => item.userId === activeMemberId);
      if (!membership || membership.role !== "Owner")
        return { success: false, error: "Only the workspace Owner can restore it." };
      setAccount((current) => ({
        ...current,
        workspaces: current.workspaces.map((data) =>
          data.workspace.id === workspaceId
            ? (() => {
                const { archivedAt: _archivedAt, ...workspace } = data.workspace;
                return { ...data, workspace: { ...workspace, status: "active" as const } };
              })()
            : data,
        ),
      }));
      return { success: true };
    };

    const leaveWorkspace = (workspaceId: string): StoreResult => {
      const target = account.workspaces.find((data) => data.workspace.id === workspaceId);
      const membership = target?.memberships.find((item) => item.userId === activeMemberId);
      if (!target || !membership || membership.status !== "active")
        return { success: false, error: "You are not an active member of this workspace." };
      if (membership.role === "Owner")
        return {
          success: false,
          error: "The Owner must archive the workspace instead of leaving it.",
        };
      if (timerRef.current.status !== "idle")
        return {
          success: false,
          error: "Pause or stop the active timer before leaving a workspace.",
        };
      const accessible = account.workspaces.filter(
        (data) =>
          data.workspace.id !== workspaceId &&
          data.memberships.some(
            (item) => item.userId === activeMemberId && item.status === "active",
          ),
      );
      if (accessible.length === 0)
        return {
          success: false,
          error: "Keep at least one workspace available before leaving this one.",
        };
      const nextWorkspace = accessible[0];
      if (!nextWorkspace) return { success: false, error: "No other workspace is available." };
      setAccount((current) => ({
        ...current,
        workspaces: current.workspaces.map((data) =>
          data.workspace.id === workspaceId
            ? {
                ...data,
                memberships: data.memberships.map((item) =>
                  item.userId === activeMemberId ? { ...item, status: "removed" } : item,
                ),
                projects: data.projects.map((project) => ({
                  ...project,
                  memberIds: project.memberIds.filter((id) => id !== activeMemberId),
                })),
              }
            : data,
        ),
      }));
      setActiveWorkspaceId(nextWorkspace.workspace.id);
      setEntries(nextWorkspace.entries);
      setProjects(nextWorkspace.projects);
      setClients(nextWorkspace.clients);
      setMembers(
        nextWorkspace.memberships
          .map((item) => membershipToMember(item, account.identities))
          .filter((member): member is Member => member !== null),
      );
      setSettingsState(nextWorkspace.settings);
      setTrelloState(nextWorkspace.trello);
      const nextTimer = readPersistedTimer(
        activeMemberId,
        nextWorkspace.workspace.id,
        nextWorkspace.projects,
      );
      timerRef.current = nextTimer;
      setTimer(nextTimer);
      setElapsed(elapsedForTimer(nextTimer));
      return { success: true };
    };

    const setActiveMember = (memberId: string): StoreResult => {
      const member = members.find(
        (candidate) => candidate.id === memberId && candidate.status === "active",
      );
      if (!member) return { success: false, error: "Choose an active account in this workspace." };
      if (timerRef.current.status !== "idle")
        return { success: false, error: "Stop the active timer before changing accounts." };
      try {
        window.localStorage.setItem(ACTIVE_MEMBER_STORAGE_KEY, memberId);
      } catch {
        /* Memory fallback. */
      }
      const nextTimer = readPersistedTimer(memberId, activeWorkspaceId, projects);
      timerRef.current = nextTimer;
      setTimer(nextTimer);
      setElapsed(elapsedForTimer(nextTimer));
      setActiveMemberId(memberId);
      return { success: true };
    };

    const signOut = (): StoreResult => {
      if (timerRef.current.status !== "idle")
        return { success: false, error: "Stop the active timer before signing out." };
      resetSessionDefaultAvatar();
      try {
        window.localStorage.setItem(SESSION_STORAGE_KEY, "signed-out");
      } catch {
        /* Memory fallback. */
      }
      setSessionStatus("signed-out");
      return { success: true };
    };

    const resumeSession = (memberId: string): StoreResult => {
      const member = members.find(
        (candidate) => candidate.id === memberId && candidate.status === "active",
      );
      if (!member) return { success: false, error: "Choose an active account." };
      if (timerRef.current.status !== "idle")
        return { success: false, error: "Stop the active timer before changing accounts." };
      resetSessionDefaultAvatar();
      try {
        window.localStorage.setItem(ACTIVE_MEMBER_STORAGE_KEY, memberId);
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        /* Memory fallback. */
      }
      const nextTimer = readPersistedTimer(memberId, activeWorkspaceId, projects);
      timerRef.current = nextTimer;
      setTimer(nextTimer);
      setElapsed(elapsedForTimer(nextTimer));
      setActiveMemberId(memberId);
      setSessionStatus("active");
      return { success: true };
    };

    const summaries: WorkspaceSummary[] = account.workspaces
      .filter((data) =>
        data.memberships.some((item) => item.userId === activeMemberId && item.status === "active"),
      )
      .map((data) => {
        const membership = data.memberships.find((item) => item.userId === activeMemberId)!;
        const owner = account.identities.find((identity) => identity.id === data.workspace.ownerId);
        return {
          ...data.workspace,
          ownerName: owner?.name ?? "Unknown owner",
          role: membership.role,
          membershipStatus: membership.status,
          isOwned: data.workspace.ownerId === activeMemberId,
        };
      });

    return {
      entries,
      projects,
      clients,
      members,
      timer,
      recentTasks,
      elapsed,
      trello,
      settings,
      preferences,
      billingPreferencesByUserId,
      currentMember,
      currentWorkspace,
      currentWorkspaceMembership,
      workspaces: summaries,
      activeWorkspaceId,
      sessionStatus,
      can,
      canTrackProject,
      findEntryConflict,
      setActiveMember,
      currentUserId: activeMemberId,
      today,
      startTimer,
      startTimerFromTask,
      updateTimer,
      setTimerElapsed,
      pauseTimer,
      resumeTimer,
      stopTimer,
      addEntry,
      updateEntry,
      deleteEntry,
      restoreEntry,
      addProject,
      updateProject,
      deleteProject,
      addClient,
      updateClient,
      deleteClient,
      inviteMember,
      resendInvite,
      cancelInvite,
      removeMember,
      restoreMember,
      updateMemberRole,
      setTrello,
      setWorkspaceSettings,
      setUserPreferences,
      updateCurrentMemberName,
      updateCurrentMemberEmail,
      switchWorkspace,
      createWorkspace,
      updateWorkspace,
      archiveWorkspace,
      restoreWorkspace,
      leaveWorkspace,
      signOut,
      resumeSession,
    };
  }, [
    account,
    activeMemberId,
    activeWorkspaceId,
    clients,
    currentMember,
    currentWorkspaceMembership,
    currentWorkspace,
    elapsed,
    entries,
    members,
    preferences,
    billingPreferencesByUserId,
    projects,
    recentTasks,
    sessionStatus,
    settings,
    timer,
    today,
    trello,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}

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
    id === null
      ? "No project"
      : (projects.find((project) => project.id === id)?.name ?? "Unknown project");
}
