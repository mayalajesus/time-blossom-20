alter table public.user_preferences
  add column if not exists active_workspace_id uuid references public.workspaces (id) on delete set null,
  add column if not exists report_filters jsonb not null default '{}'::jsonb;

alter table public.user_preferences
  drop constraint if exists user_preferences_report_filters_object;

alter table public.user_preferences
  add constraint user_preferences_report_filters_object
  check (jsonb_typeof(report_filters) = 'object');

alter table public.workspaces
  add column if not exists logo_path text;
