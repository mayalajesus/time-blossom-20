import type { PersistedAccount, TimerState } from "./store";
import type { DataSourceResult, ReportEntriesQuery } from "./data-source";
import type { TimeEntry } from "./mock-data";

export interface AccountDataSource {
  loadAccount(userId: string): Promise<DataSourceResult<PersistedAccount>>;
  loadReportEntries(
    userId: string,
    query: ReportEntriesQuery,
  ): Promise<DataSourceResult<TimeEntry[]>>;
  syncAccount(userId: string, account: PersistedAccount): Promise<DataSourceResult<null>>;
  getActiveTimer(userId: string, workspaceId: string): Promise<DataSourceResult<TimerState | null>>;
  saveActiveTimer(userId: string, timer: TimerState): Promise<DataSourceResult<TimerState>>;
  clearActiveTimer(userId: string, workspaceId: string): Promise<DataSourceResult<null>>;
}
