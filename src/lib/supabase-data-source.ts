import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Member, Project, TimeEntry } from "./mock-data";
import type {
  AppDataSource,
  DataSourceResult,
  ReportEntriesQuery,
  ReportQuery,
} from "./data-source";
import type { TimerState, UserPreferences, Workspace, WorkspaceSettings } from "./store";
import { supabase } from "./supabase";
import { defaultCurrencyForLocale, isCurrencyCode } from "./billing";

type PreferenceRow = {
  user_id: string;
  language: UserPreferences["language"];
  theme: UserPreferences["theme"];
  timezone: string;
  idle_detection: boolean;
  hourly_rate?: number;
  currency?: string;
  active_workspace_id?: string | null;
  report_filters?: UserPreferences["reportFilters"] | null;
  avatar_data_url?: string | null;
  profiles?: { avatar_path?: string | null } | null;
};
type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  status: Workspace["status"];
  created_at: string;
  archived_at?: string | null;
};
type WorkspaceSettingsRow = {
  workspace_id: string;
  default_billable: boolean;
  week_start: WorkspaceSettings["weekStart"];
};
type ProjectRow = {
  id: string;
  name: string;
  client_id: string;
  billable: boolean;
  status: Project["status"];
  color: string;
  last_activity: string;
  project_members?: Array<{ user_id: string }>;
};
type TimerRow = {
  user_id: string;
  workspace_id: string;
  status: TimerState["status"];
  task: string;
  project_id: string | null;
  billable: boolean;
  started_at: string | null;
  started_date: string | null;
  accumulated_seconds: number;
  start_clock: string;
  hourly_rate?: number | null;
  currency?: string | null;
};
type EntryRow = TimeEntry & { workspace_id: string };

function ok<T>(data: T): DataSourceResult<T> {
  return { success: true, data };
}

function fail<T>(message: string): DataSourceResult<T> {
  return { success: false, error: message };
}

function result<T>(data: T | null, error: { message: string } | null): DataSourceResult<T> {
  return error ? fail(error.message) : ok(data as T);
}

function requiredClient(client: SupabaseClient | null): asserts client is SupabaseClient {
  if (!client) throw new Error("Supabase is not configured for this environment.");
}

function mapTimer(row: TimerRow): TimerState {
  return {
    status: row.status,
    workspaceId: row.workspace_id,
    task: row.task,
    projectId: row.project_id,
    billable: row.billable,
    startedAt: row.started_at ? Date.parse(row.started_at) : null,
    startedDate: row.started_date,
    accumulated: row.accumulated_seconds,
    startClock: row.start_clock,
    ...(typeof row.hourly_rate === "number" ? { hourlyRate: row.hourly_rate } : {}),
    ...(isCurrencyCode(row.currency) ? { currency: row.currency } : {}),
  };
}

async function mapPreferences(
  client: SupabaseClient,
  row: PreferenceRow,
): Promise<UserPreferences> {
  let avatarUrl: string | null = null;
  const avatarPath = row.profiles?.avatar_path;
  if (avatarPath) {
    const signed = await client.storage.from("avatars").createSignedUrl(avatarPath, 3_600);
    avatarUrl = signed.data?.signedUrl ?? null;
  }
  avatarUrl ??= row.avatar_data_url ?? null;
  return {
    language: row.language,
    theme: row.theme,
    timezone: row.timezone,
    idleDetection: row.idle_detection,
    avatarUrl,
    hourlyRate: typeof row.hourly_rate === "number" && row.hourly_rate >= 0 ? row.hourly_rate : 0,
    currency: isCurrencyCode(row.currency) ? row.currency : defaultCurrencyForLocale(row.language),
    activeWorkspaceId: row.active_workspace_id ?? null,
    reportFilters: row.report_filters ?? {},
  };
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    logoDataUrl: null,
    status: row.status,
    createdAt: row.created_at,
    ...(row.archived_at ? { archivedAt: row.archived_at } : {}),
  };
}

function mapWorkspaceSettings(row: WorkspaceSettingsRow): WorkspaceSettings {
  return { defaultBillable: row.default_billable, weekStart: row.week_start };
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id,
    billable: row.billable,
    status: row.status,
    color: row.color,
    lastActivity: row.last_activity,
    memberIds: row.project_members?.map((member) => member.user_id) ?? [],
  };
}

function mapEntry(row: EntryRow): TimeEntry {
  const raw = row as unknown as {
    start_time: string;
    end_time: string;
    end_date: string;
    start_at: string | null;
    end_at: string | null;
    duration_seconds: number;
    project_id: string | null;
    user_id: string;
    hourly_rate?: number | null;
    currency?: string | null;
  };
  return {
    id: row.id,
    date: row.date,
    start: raw.start_time.slice(0, 5),
    end: raw.end_time.slice(0, 5),
    endDate: raw.end_date,
    startTimestamp: raw.start_at ? Date.parse(raw.start_at) : undefined,
    endTimestamp: raw.end_at ? Date.parse(raw.end_at) : undefined,
    seconds: raw.duration_seconds,
    userId: raw.user_id,
    projectId: raw.project_id,
    task: row.task,
    description: row.description,
    billable: row.billable,
    ...(typeof raw.hourly_rate === "number" ? { hourlyRate: raw.hourly_rate } : {}),
    ...(isCurrencyCode(raw.currency) ? { currency: raw.currency } : {}),
  };
}

function entryPayload(entry: Omit<TimeEntry, "id"> & { workspaceId?: string }) {
  return {
    ...(entry.workspaceId ? { workspace_id: entry.workspaceId } : {}),
    user_id: entry.userId,
    date: entry.date,
    start_time: entry.start,
    end_time: entry.end,
    end_date: entry.endDate ?? entry.date,
    start_at: entry.startTimestamp ? new Date(entry.startTimestamp).toISOString() : null,
    end_at: entry.endTimestamp ? new Date(entry.endTimestamp).toISOString() : null,
    duration_seconds: entry.seconds,
    project_id: entry.projectId,
    task: entry.task,
    description: entry.description ?? null,
    billable: entry.billable,
    hourly_rate: entry.hourlyRate ?? null,
    currency: entry.currency ?? null,
  };
}

function entryPatch(patch: Partial<Omit<TimeEntry, "id">>): Record<string, unknown> {
  const source = patch as Record<string, unknown>;
  const mapped: Record<string, unknown> = {};
  const keys: Record<string, string> = {
    userId: "user_id",
    start: "start_time",
    end: "end_time",
    endDate: "end_date",
    startTimestamp: "start_at",
    endTimestamp: "end_at",
    seconds: "duration_seconds",
    projectId: "project_id",
    hourlyRate: "hourly_rate",
  };
  for (const [key, value] of Object.entries(source)) {
    const target = keys[key] ?? key;
    mapped[target] = key.endsWith("Timestamp")
      ? value === undefined
        ? null
        : new Date(value as number).toISOString()
      : value;
  }
  return mapped;
}

export function createSupabaseDataSource(client: SupabaseClient | null = supabase): AppDataSource {
  const call = async <T>(
    operation: () => Promise<{ data: T | null; error: { message: string } | null }>,
  ): Promise<DataSourceResult<T>> => {
    try {
      requiredClient(client);
      const response = await operation();
      return result(response.data, response.error);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "The data request failed.");
    }
  };

  return {
    async getSession() {
      try {
        requiredClient(client);
        const response = await client!.auth.getSession();
        return result(response.data.session, response.error);
      } catch (error) {
        return fail(error instanceof Error ? error.message : "The session request failed.");
      }
    },

    getPreferences: (userId) =>
      call(async () => {
        const response = await client!
          .from("user_preferences")
          .select("*, profiles(avatar_path)")
          .eq("user_id", userId)
          .single();
        return { data: response.data as PreferenceRow, error: response.error };
      }).then(async (response) =>
        response.success ? ok(await mapPreferences(client!, response.data)) : response,
      ),

    updatePreferences: (userId, patch) =>
      call(async () => {
        const {
          avatarUrl: _avatarUrl,
          idleDetection,
          hourlyRate,
          activeWorkspaceId,
          reportFilters,
          ...rest
        } = patch;
        const response = await client!
          .from("user_preferences")
          .upsert({
            user_id: userId,
            ...rest,
            ...(idleDetection === undefined ? {} : { idle_detection: idleDetection }),
            ...(hourlyRate === undefined ? {} : { hourly_rate: hourlyRate }),
            ...(activeWorkspaceId === undefined ? {} : { active_workspace_id: activeWorkspaceId }),
            ...(reportFilters === undefined ? {} : { report_filters: reportFilters }),
          })
          .select("*, profiles(avatar_path)")
          .single();
        return { data: response.data as PreferenceRow, error: response.error };
      }).then(async (response) =>
        response.success ? ok(await mapPreferences(client!, response.data)) : response,
      ),

    updateProfileName: (userId, name) =>
      call(async () => {
        const normalizedName = name.trim();
        const initials = normalizedName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("");
        const response = await client!
          .from("profiles")
          .update({
            name: normalizedName,
            initials: initials || "?",
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
        return { data: null, error: response.error };
      }),

    uploadAvatar: (userId, image) =>
      call(async () => {
        const current = await client!
          .from("profiles")
          .select("avatar_path")
          .eq("id", userId)
          .single();
        if (current.error) return { data: null, error: current.error };
        const previousPath = (current.data as { avatar_path?: string | null }).avatar_path;
        const path = `${userId}/avatar-${Date.now()}.jpg`;
        const upload = await client!.storage.from("avatars").upload(path, image, {
          contentType: image.type || "image/jpeg",
          upsert: false,
        });
        if (upload.error) return { data: null, error: upload.error };
        const signed = await client!.storage.from("avatars").createSignedUrl(path, 3_600);
        if (signed.error || !signed.data?.signedUrl) {
          await client!.storage.from("avatars").remove([path]);
          return {
            data: null,
            error: signed.error ?? { message: "The uploaded profile photo is unavailable." },
          };
        }
        const updated = await client!
          .from("profiles")
          .update({ avatar_path: path, updated_at: new Date().toISOString() })
          .eq("id", userId);
        if (updated.error) {
          await client!.storage.from("avatars").remove([path]);
          return { data: null, error: updated.error };
        }
        if (previousPath && previousPath !== path) {
          await client!.storage.from("avatars").remove([previousPath]);
        }
        return { data: signed.data.signedUrl, error: null };
      }),

    removeAvatar: (userId) =>
      call(async () => {
        const current = await client!
          .from("profiles")
          .select("avatar_path")
          .eq("id", userId)
          .single();
        if (current.error) return { data: null, error: current.error };
        const path = (current.data as { avatar_path?: string | null }).avatar_path;
        const updated = await client!
          .from("profiles")
          .update({ avatar_path: null, updated_at: new Date().toISOString() })
          .eq("id", userId);
        if (updated.error) return { data: null, error: updated.error };
        if (!path) return { data: null, error: null };

        const removed = await client!.storage.from("avatars").remove([path]);
        if (!removed.error) return { data: null, error: null };

        const restored = await client!
          .from("profiles")
          .update({ avatar_path: path, updated_at: new Date().toISOString() })
          .eq("id", userId);
        return {
          data: null,
          error:
            restored.error ??
            ({ message: `The profile photo could not be removed: ${removed.error.message}` } as {
              message: string;
            }),
        };
      }),

    listWorkspaces: (userId) =>
      call(async () => {
        const response = await client!
          .from("workspace_members")
          .select("workspaces(*)")
          .eq("user_id", userId)
          .eq("status", "active");
        const workspaces = (response.data ?? [])
          .map((row) => row.workspaces as unknown as WorkspaceRow | null)
          .filter((workspace): workspace is WorkspaceRow => workspace !== null);
        return { data: workspaces.map(mapWorkspace), error: response.error };
      }),

    createWorkspace: (userId, name) =>
      call(async () => {
        const response = await client!
          .from("workspaces")
          .insert({ owner_id: userId, name: name.trim() })
          .select("*")
          .single();
        return { data: response.data as WorkspaceRow, error: response.error };
      }).then((response) => (response.success ? ok(mapWorkspace(response.data)) : response)),

    updateWorkspace: (workspaceId, patch) =>
      call(async () => {
        const response = await client!
          .from("workspaces")
          .update(patch)
          .eq("id", workspaceId)
          .select("*")
          .single();
        return { data: response.data as WorkspaceRow, error: response.error };
      }).then((response) => (response.success ? ok(mapWorkspace(response.data)) : response)),

    getWorkspaceSettings: (workspaceId) =>
      call(async () => {
        const response = await client!
          .from("workspace_settings")
          .select("*")
          .eq("workspace_id", workspaceId)
          .single();
        return { data: response.data as WorkspaceSettingsRow, error: response.error };
      }).then((response) =>
        response.success ? ok(mapWorkspaceSettings(response.data)) : response,
      ),

    updateWorkspaceSettings: (workspaceId, patch) =>
      call(async () => {
        const response = await client!
          .from("workspace_settings")
          .upsert({
            workspace_id: workspaceId,
            ...(patch.defaultBillable === undefined
              ? {}
              : { default_billable: patch.defaultBillable }),
            ...(patch.weekStart === undefined ? {} : { week_start: patch.weekStart }),
          })
          .select("*")
          .single();
        return { data: response.data as WorkspaceSettingsRow, error: response.error };
      }).then((response) =>
        response.success ? ok(mapWorkspaceSettings(response.data)) : response,
      ),

    listMembers: (workspaceId) =>
      call(async () => {
        const response = await client!
          .from("workspace_members")
          .select("user_id, role, status, invited_at, profiles(name, email, initials)")
          .eq("workspace_id", workspaceId);
        const members = (response.data ?? []).map((row) => {
          const profile = (row.profiles ?? {}) as Partial<Member>;
          return {
            id: row.user_id,
            name: profile.name ?? "",
            email: profile.email ?? "",
            initials: profile.initials ?? "",
            role: row.role,
            status: row.status,
            ...(row.invited_at ? { invitedAt: row.invited_at } : {}),
          } as Member;
        });
        return { data: members, error: response.error };
      }),

    listClients: (workspaceId) =>
      call(async () => {
        const response = await client!.from("clients").select("*").eq("workspace_id", workspaceId);
        return { data: response.data as Client[] | null, error: response.error };
      }),

    listProjects: (workspaceId) =>
      call(async () => {
        const response = await client!
          .from("projects")
          .select("*, project_members(user_id)")
          .eq("workspace_id", workspaceId);
        return { data: response.data as ProjectRow[] | null, error: response.error };
      }).then((response) => (response.success ? ok(response.data.map(mapProject)) : response)),

    listEntries: (query: ReportQuery) =>
      call(async () => {
        let request = client!
          .from("time_entries")
          .select("*")
          .eq("workspace_id", query.workspaceId)
          .gte("date", query.startDate)
          .lte("date", query.endDate)
          .order("date", { ascending: true });
        if (query.clientIds?.length) {
          const projects = await client!
            .from("projects")
            .select("id")
            .eq("workspace_id", query.workspaceId)
            .in("client_id", query.clientIds);
          if (projects.error) return { data: null, error: projects.error };
          const projectIds = (projects.data ?? []).map((project) => project.id as string);
          if (!projectIds.length) return { data: [], error: null };
          request = request.in("project_id", projectIds);
        }
        if (query.projectIds?.length) request = request.in("project_id", query.projectIds);
        if (query.memberIds?.length) request = request.in("user_id", query.memberIds);
        if (query.task) request = request.ilike("task", `%${query.task}%`);
        if (query.description) request = request.ilike("description", `%${query.description}%`);
        if (query.billable !== undefined) request = request.eq("billable", query.billable);
        const response = await request;
        return { data: response.data as EntryRow[] | null, error: response.error };
      }).then((response) =>
        response.success ? ok(response.data.map((entry) => mapEntry(entry))) : response,
      ),

    loadReportEntries: (query: ReportEntriesQuery) =>
      call(async () => {
        const response = await client!
          .from("time_entries")
          .select("*")
          .eq("workspace_id", query.workspaceId)
          .or(
            `and(date.gte.${query.startDate},date.lte.${query.endDate}),and(date.lt.${query.startDate},end_date.gte.${query.startDate})`,
          )
          .order("date", { ascending: true })
          .order("start_time", { ascending: true });
        return { data: response.data as EntryRow[] | null, error: response.error };
      }).then((response) =>
        response.success ? ok(response.data.map((entry) => mapEntry(entry))) : response,
      ),

    getActiveTimer: (userId, workspaceId) =>
      call(async () => {
        const response = await client!
          .from("active_timers")
          .select("*")
          .eq("user_id", userId)
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        return { data: response.data as TimerRow | null, error: response.error };
      }).then((response) =>
        response.success ? ok(response.data ? mapTimer(response.data) : null) : response,
      ),

    saveActiveTimer: (userId, timer) =>
      call(async () => {
        const response = await client!
          .from("active_timers")
          .upsert({
            user_id: userId,
            workspace_id: timer.workspaceId,
            status: timer.status,
            task: timer.task,
            project_id: timer.projectId,
            billable: timer.billable,
            started_at: timer.startedAt ? new Date(timer.startedAt).toISOString() : null,
            started_date: timer.startedDate,
            accumulated_seconds: timer.accumulated,
            start_clock: timer.startClock,
            hourly_rate: timer.hourlyRate ?? null,
            currency: timer.currency ?? null,
          })
          .select("*")
          .single();
        return { data: response.data as TimerRow | null, error: response.error };
      }).then((response) => (response.success ? ok(mapTimer(response.data)) : response)),

    clearActiveTimer: (userId, workspaceId) =>
      call(async () => {
        const response = await client!
          .from("active_timers")
          .delete()
          .eq("user_id", userId)
          .eq("workspace_id", workspaceId);
        return { data: null, error: response.error };
      }),

    createEntry: (entry) =>
      call(async () => {
        const response = await client!
          .from("time_entries")
          .insert(entryPayload(entry))
          .select("*")
          .single();
        return { data: response.data as EntryRow, error: response.error };
      }).then((response) => (response.success ? ok(mapEntry(response.data)) : response)),

    updateEntry: (id, patch) =>
      call(async () => {
        const response = await client!
          .from("time_entries")
          .update(entryPatch(patch))
          .eq("id", id)
          .select("*")
          .single();
        return { data: response.data as EntryRow, error: response.error };
      }).then((response) => (response.success ? ok(mapEntry(response.data)) : response)),

    deleteEntry: (id) =>
      call(async () => {
        const response = await client!.from("time_entries").delete().eq("id", id);
        return { data: null, error: response.error };
      }),

    inviteMember: (workspaceId, email, role) =>
      call(async () => {
        const response = await client!.functions.invoke("invite-member", {
          body: { workspaceId, email, role, redirectTo: `${window.location.origin}/invite/accept` },
        });
        return { data: null, error: response.error };
      }),

    acceptInvitation: (invitationId) =>
      call(async () => {
        const response = await client!.functions.invoke("accept-invitation", {
          body: { invitationId },
        });
        const workspaceId =
          response.data && typeof response.data === "object" && "workspaceId" in response.data
            ? String(response.data.workspaceId)
            : "";
        return {
          data: workspaceId ? { workspaceId } : null,
          error:
            response.error ??
            (workspaceId ? null : { message: "The invitation response was invalid." }),
        };
      }),
  };
}
