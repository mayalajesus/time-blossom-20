import type { PersistedAccount, TimerState } from "./store";
import type { DataSourceResult } from "./data-source";

export interface AccountDataSource {
  loadAccount(userId: string): Promise<DataSourceResult<PersistedAccount>>;
  syncAccount(userId: string, account: PersistedAccount): Promise<DataSourceResult<null>>;
  getActiveTimer(userId: string, workspaceId: string): Promise<DataSourceResult<TimerState | null>>;
  saveActiveTimer(userId: string, timer: TimerState): Promise<DataSourceResult<TimerState>>;
  clearActiveTimer(userId: string, workspaceId: string): Promise<DataSourceResult<null>>;
}
