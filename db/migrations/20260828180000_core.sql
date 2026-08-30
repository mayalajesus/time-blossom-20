create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id text primary key check (char_length(trim(id)) between 1 and 255),
  auth_issuer text,
  name text not null default '',
  email text not null default '',
  initials text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.id is
  'Authentication subject (sub) copied verbatim from the verified token.';

create table if not exists public.user_preferences (
  user_id text primary key references public.profiles (id) on delete cascade,
  language text not null default 'en-US' check (language in ('en-US', 'pt-BR')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  timezone text not null default 'UTC' check (char_length(trim(timezone)) between 1 and 100),
  reminders boolean not null default true,
  weekly_digest boolean not null default false,
  idle_detection boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  owner_id text not null references public.profiles (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, owner_id)
);

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  default_billable boolean not null default true,
  week_start text not null default 'monday' check (week_start in ('monday', 'sunday')),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('Owner', 'Admin', 'Member')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  invited_at timestamptz,
  joined_at timestamptz,
  primary key (workspace_id, user_id)
);

create unique index if not exists workspace_one_owner_idx
  on public.workspace_members (workspace_id)
  where role = 'Owner' and status = 'active';

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  contact text not null default '',
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  client_id uuid not null,
  billable boolean not null default true,
  status text not null default 'active' check (status in ('active', 'on-hold', 'archived')),
  color text not null default 'accent',
  last_activity date not null default current_date,
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint projects_client_workspace_fk
    foreign key (client_id, workspace_id)
    references public.clients (id, workspace_id)
    on delete restrict
);

create table if not exists public.project_members (
  workspace_id uuid not null,
  project_id uuid not null,
  user_id text not null,
  primary key (project_id, user_id),
  constraint project_members_project_workspace_fk
    foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id)
    on delete cascade,
  constraint project_members_workspace_member_fk
    foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id)
    on delete cascade
);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (char_length(trim(email)) between 3 and 320),
  role text not null check (role in ('Admin', 'Member')),
  invited_by text not null references public.profiles (id) on delete restrict,
  auth_user_id text references public.profiles (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);

create unique index if not exists pending_workspace_invite_idx
  on public.workspace_invitations (workspace_id, lower(email))
  where status = 'pending';

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  end_date date not null,
  start_at timestamptz,
  end_at timestamptz,
  duration_seconds integer not null check (duration_seconds > 0),
  project_id uuid,
  task text not null check (char_length(trim(task)) between 1 and 240),
  description text,
  billable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_entries_member_workspace_fk
    foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id)
    on delete restrict,
  constraint time_entries_project_workspace_fk
    foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id)
    on delete set null (project_id),
  constraint time_entries_dates_check check (end_date >= date),
  constraint time_entries_timestamps_check check (
    (start_at is null and end_at is null)
    or (start_at is not null and end_at is not null and end_at > start_at)
  )
);

create table if not exists public.active_timers (
  user_id text not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null check (status in ('running', 'paused')),
  task text not null check (char_length(trim(task)) between 1 and 240),
  project_id uuid,
  billable boolean not null default true,
  started_at timestamptz,
  started_date date,
  accumulated_seconds integer not null default 0 check (accumulated_seconds >= 0),
  start_clock time not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id),
  constraint active_timers_member_workspace_fk
    foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id)
    on delete cascade,
  constraint active_timers_project_workspace_fk
    foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id)
    on delete set null (project_id),
  constraint active_timers_state_check check (
    (status = 'running' and started_at is not null)
    or (status = 'paused' and started_at is null)
  )
);

create index if not exists workspace_members_user_workspace_idx
  on public.workspace_members (user_id, workspace_id);
create index if not exists clients_workspace_idx
  on public.clients (workspace_id);
create index if not exists projects_workspace_idx
  on public.projects (workspace_id);
create index if not exists projects_workspace_client_idx
  on public.projects (workspace_id, client_id);
create index if not exists project_members_workspace_user_idx
  on public.project_members (workspace_id, user_id);
create index if not exists invitations_workspace_status_idx
  on public.workspace_invitations (workspace_id, status);
create index if not exists time_entries_workspace_date_idx
  on public.time_entries (workspace_id, date);
create index if not exists time_entries_user_date_idx
  on public.time_entries (user_id, date);
create index if not exists time_entries_workspace_user_date_idx
  on public.time_entries (workspace_id, user_id, date);
create index if not exists time_entries_workspace_project_date_idx
  on public.time_entries (workspace_id, project_id, date);
create index if not exists active_timers_workspace_idx
  on public.active_timers (workspace_id);

create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  values (new.id, new.owner_id, 'Owner', 'active', now())
  on conflict (workspace_id, user_id) do update
    set role = 'Owner', status = 'active', joined_at = coalesce(workspace_members.joined_at, now());

  insert into public.workspace_settings (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();
