import type { PersistedAccount, UserPreferences } from "./account-types";
import type { TimerState } from "./store";
import type { Member, Role, TimeEntry } from "./domain";

export type DataSourceResult<T> = { success: true; data: T } | { success: false; error: string };

export type ReportEntriesQuery = {
  workspaceId: string;
  startDate: string;
  endDate: string;
};

export interface AccountDataSource {
  loadAccount(userId: string): Promise<DataSourceResult<PersistedAccount>>;
  loadReportEntries(
    userId: string,
    query: ReportEntriesQuery,
  ): Promise<DataSourceResult<TimeEntry[]>>;
  syncAccount(userId: string, account: PersistedAccount): Promise<DataSourceResult<null>>;
  updatePreferences(
    userId: string,
    patch: Partial<UserPreferences>,
  ): Promise<DataSourceResult<null>>;
  getActiveTimer(userId: string, workspaceId: string): Promise<DataSourceResult<TimerState | null>>;
  saveActiveTimer(userId: string, timer: TimerState): Promise<DataSourceResult<TimerState>>;
  clearActiveTimer(userId: string, workspaceId: string): Promise<DataSourceResult<null>>;
  inviteMember(
    workspaceId: string,
    email: string,
    role: Exclude<Role, "Owner">,
  ): Promise<DataSourceResult<Member>>;
  resendInvitation(workspaceId: string, invitationId: string): Promise<DataSourceResult<Member>>;
  cancelInvitation(workspaceId: string, invitationId: string): Promise<DataSourceResult<null>>;
  updateProfileName(name: string): Promise<DataSourceResult<null>>;
  uploadAvatar(avatarDataUrl: string): Promise<DataSourceResult<string>>;
  removeAvatar(): Promise<DataSourceResult<null>>;
  acceptInvitation(invitationId: string): Promise<DataSourceResult<{ workspaceId: string }>>;
}
