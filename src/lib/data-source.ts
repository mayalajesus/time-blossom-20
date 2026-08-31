import type { Session } from "@supabase/supabase-js";
import type { Client, Member, Project, TimeEntry } from "./mock-data";
import type { TimerState, UserPreferences, Workspace, WorkspaceSettings } from "./store";

export type DataSourceResult<T> = { success: true; data: T } | { success: false; error: string };

export type ReportQuery = {
  workspaceId: string;
  startDate: string;
  endDate: string;
  clientIds?: string[];
  projectIds?: string[];
  memberIds?: string[];
  task?: string;
  description?: string;
  billable?: boolean;
};

export type ReportEntriesQuery = Pick<ReportQuery, "workspaceId" | "startDate" | "endDate">;

export interface AppDataSource {
  getSession(): Promise<DataSourceResult<Session | null>>;
  getPreferences(userId: string): Promise<DataSourceResult<UserPreferences>>;
  updatePreferences(
    userId: string,
    patch: Partial<UserPreferences>,
  ): Promise<DataSourceResult<UserPreferences>>;
  updateProfileName(userId: string, name: string): Promise<DataSourceResult<null>>;
  uploadAvatar(userId: string, image: Blob): Promise<DataSourceResult<string>>;
  removeAvatar(userId: string): Promise<DataSourceResult<null>>;
  listWorkspaces(userId: string): Promise<DataSourceResult<Workspace[]>>;
  createWorkspace(userId: string, name: string): Promise<DataSourceResult<Workspace>>;
  updateWorkspace(
    workspaceId: string,
    patch: Partial<Pick<Workspace, "name" | "status">>,
  ): Promise<DataSourceResult<Workspace>>;
  getWorkspaceSettings(workspaceId: string): Promise<DataSourceResult<WorkspaceSettings>>;
  updateWorkspaceSettings(
    workspaceId: string,
    patch: Partial<WorkspaceSettings>,
  ): Promise<DataSourceResult<WorkspaceSettings>>;
  listMembers(workspaceId: string): Promise<DataSourceResult<Member[]>>;
  listClients(workspaceId: string): Promise<DataSourceResult<Client[]>>;
  listProjects(workspaceId: string): Promise<DataSourceResult<Project[]>>;
  listEntries(query: ReportQuery): Promise<DataSourceResult<TimeEntry[]>>;
  loadReportEntries(query: ReportEntriesQuery): Promise<DataSourceResult<TimeEntry[]>>;
  getActiveTimer(userId: string, workspaceId: string): Promise<DataSourceResult<TimerState | null>>;
  saveActiveTimer(userId: string, timer: TimerState): Promise<DataSourceResult<TimerState>>;
  clearActiveTimer(userId: string, workspaceId: string): Promise<DataSourceResult<null>>;
  createEntry(
    entry: Omit<TimeEntry, "id"> & { workspaceId: string },
  ): Promise<DataSourceResult<TimeEntry>>;
  updateEntry(
    id: string,
    patch: Partial<Omit<TimeEntry, "id">>,
  ): Promise<DataSourceResult<TimeEntry>>;
  deleteEntry(id: string): Promise<DataSourceResult<null>>;
  inviteMember(
    workspaceId: string,
    email: string,
    role: "Admin" | "Member",
  ): Promise<DataSourceResult<null>>;
  acceptInvitation(invitationId: string): Promise<DataSourceResult<{ workspaceId: string }>>;
}
