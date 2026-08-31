import type { PersistedAccount, TimerState, UserPreferences } from "./store";
import type { DataSourceResult, ReportEntriesQuery } from "./data-source";
import type { Member, Role, TimeEntry } from "./mock-data";

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
}
