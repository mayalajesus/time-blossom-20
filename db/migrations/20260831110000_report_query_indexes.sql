create index if not exists time_entries_workspace_end_date_idx
  on public.time_entries (workspace_id, end_date);
