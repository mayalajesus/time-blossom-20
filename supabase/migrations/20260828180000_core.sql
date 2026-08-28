create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  initials text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  language text not null default 'en-US' check (language in ('en-US', 'pt-BR')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  timezone text not null default 'UTC',
  reminders boolean not null default true,
  weekly_digest boolean not null default false,
  idle_detection boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  owner_id uuid not null references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  default_billable boolean not null default true,
  week_start text not null default 'monday' check (week_start in ('monday', 'sunday')),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
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
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  client_id uuid not null references public.clients (id) on delete restrict,
  billable boolean not null default true,
  status text not null default 'active' check (status in ('active', 'on-hold', 'archived')),
  color text not null default 'bg-accent',
  last_activity date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (project_id, user_id)
);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null check (role in ('Admin', 'Member')),
  invited_by uuid not null references public.profiles (id),
  auth_user_id uuid references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
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
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  end_date date not null,
  start_at timestamptz,
  end_at timestamptz,
  duration_seconds integer not null check (duration_seconds > 0),
  project_id uuid references public.projects (id) on delete set null,
  task text not null check (char_length(trim(task)) between 1 and 240),
  description text,
  billable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((start_at is null and end_at is null) or (start_at is not null and end_at is not null and end_at >= start_at))
);

create index if not exists time_entries_workspace_date_idx
  on public.time_entries (workspace_id, date);

create table if not exists public.active_timers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null check (status in ('running', 'paused')),
  task text not null check (char_length(trim(task)) between 1 and 240),
  project_id uuid references public.projects (id) on delete set null,
  billable boolean not null default true,
  started_at timestamptz,
  started_date date,
  accumulated_seconds integer not null default 0 check (accumulated_seconds >= 0),
  start_clock time not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

create or replace function public.validate_workspace_references()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_table_name = 'projects' then
    if not exists (
      select 1 from public.clients
      where id = new.client_id and workspace_id = new.workspace_id
    ) then
      raise exception 'The project client must belong to the same workspace.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'project_members' then
    if not exists (
      select 1
      from public.projects project
      join public.workspace_members member on member.workspace_id = project.workspace_id
      where project.id = new.project_id
        and member.user_id = new.user_id
        and member.status = 'active'
    ) then
      raise exception 'Project members must belong to the workspace.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'time_entries' then
    if not exists (
      select 1 from public.workspace_members
      where workspace_id = new.workspace_id
        and user_id = new.user_id
        and status = 'active'
    ) then
      raise exception 'Time entries require an active workspace member.' using errcode = '23514';
    end if;
    if new.project_id is not null and not exists (
      select 1 from public.projects
      where id = new.project_id and workspace_id = new.workspace_id
    ) then
      raise exception 'The time entry project must belong to the same workspace.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'active_timers' then
    if new.project_id is not null and not exists (
      select 1 from public.projects
      where id = new.project_id and workspace_id = new.workspace_id
    ) then
      raise exception 'The active timer project must belong to the same workspace.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_workspace_references on public.projects;
create trigger projects_workspace_references
  before insert or update on public.projects
  for each row execute procedure public.validate_workspace_references();

drop trigger if exists project_members_workspace_references on public.project_members;
create trigger project_members_workspace_references
  before insert or update on public.project_members
  for each row execute procedure public.validate_workspace_references();

drop trigger if exists time_entries_workspace_references on public.time_entries;
create trigger time_entries_workspace_references
  before insert or update on public.time_entries
  for each row execute procedure public.validate_workspace_references();

drop trigger if exists active_timers_workspace_references on public.active_timers;
create trigger active_timers_workspace_references
  before insert or update on public.active_timers
  for each row execute procedure public.validate_workspace_references();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  display_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), '');
begin
  insert into public.profiles (id, name, email, initials)
  values (
    new.id,
    display_name,
    coalesce(new.email, ''),
    upper(left(regexp_replace(display_name, '[^[:alnum:]]', '', 'g'), 2))
  )
  on conflict (id) do update set email = excluded.email, updated_at = now();
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set email = coalesce(new.email, ''), updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute procedure public.handle_user_email_updated();

create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  values (new.id, new.owner_id, 'Owner', 'active', now())
  on conflict (workspace_id, user_id) do nothing;
  insert into public.workspace_settings (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute procedure public.handle_new_workspace();

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and status = 'active'
      and role in ('Admin', 'Owner')
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and status = 'active'
      and role = 'Owner'
  );
$$;

create or replace function public.can_manage_member(target_workspace uuid, target_user uuid)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  actor_role text;
  target_role text;
begin
  select role into actor_role
  from public.workspace_members
  where workspace_id = target_workspace
    and user_id = auth.uid()
    and status = 'active';

  select role into target_role
  from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user;

  return (actor_role = 'Owner' and target_role <> 'Owner')
    or (actor_role = 'Admin' and target_role = 'Member');
end;
$$;

create or replace function public.can_manage_member_update(
  target_workspace uuid,
  target_user uuid,
  next_role text,
  next_status text
)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  actor_role text;
  target_role text;
begin
  select role into actor_role
  from public.workspace_members
  where workspace_id = target_workspace
    and user_id = auth.uid()
    and status = 'active';

  select role into target_role
  from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user;

  if actor_role = 'Owner' then
    return target_role <> 'Owner' and next_role <> 'Owner' and next_status in ('active', 'invited', 'removed');
  end if;

  return actor_role = 'Admin'
    and target_role = 'Member'
    and next_role in ('Admin', 'Member')
    and next_status in ('active', 'invited', 'removed');
end;
$$;

create or replace function public.accept_workspace_invitation(invitation_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  invitation public.workspace_invitations%rowtype;
  current_user_id uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if current_user_id is null or current_email = '' then
    raise exception 'Your session is not valid.' using errcode = '42501';
  end if;

  select * into invitation
  from public.workspace_invitations
  where id = invitation_id
  for update;

  if not found then
    raise exception 'This invitation no longer exists.' using errcode = 'P0002';
  end if;
  if invitation.status <> 'pending' or invitation.expires_at <= now() then
    raise exception 'This invitation is no longer valid.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.workspaces
    where id = invitation.workspace_id
      and status = 'archived'
  ) then
    raise exception 'This workspace is archived.' using errcode = 'P0001';
  end if;
  if lower(invitation.email) <> current_email then
    raise exception 'This invitation belongs to a different email address.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.workspace_members
    where workspace_id = invitation.workspace_id
      and user_id = current_user_id
      and status = 'active'
  ) then
    raise exception 'You already have access to this workspace.' using errcode = '23505';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status, invited_at, joined_at)
  values (invitation.workspace_id, current_user_id, invitation.role, 'active', invitation.invited_at, now())
  on conflict (workspace_id, user_id) do update
    set role = excluded.role, status = 'active', invited_at = excluded.invited_at, joined_at = excluded.joined_at;

  update public.workspace_invitations
  set status = 'accepted', auth_user_id = current_user_id, accepted_at = now()
  where id = invitation.id;

  return invitation.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invitation(uuid) from public;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.workspace_members enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.time_entries enable row level security;
alter table public.active_timers enable row level security;

create policy profiles_select on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.workspace_members viewer
    join public.workspace_members target on target.workspace_id = viewer.workspace_id
    where viewer.user_id = auth.uid() and viewer.status = 'active'
      and target.user_id = profiles.id and target.status = 'active'
  )
);
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy preferences_owner on public.user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy workspaces_member_select on public.workspaces for select using (public.is_workspace_member(id));
create policy workspaces_owner_insert on public.workspaces for insert with check (owner_id = auth.uid());
create policy workspaces_owner_update on public.workspaces for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy workspace_settings_member_select on public.workspace_settings for select using (public.is_workspace_member(workspace_id));
create policy workspace_settings_admin_write on public.workspace_settings for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create policy members_select on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy members_self_insert on public.workspace_members for insert with check (
  user_id = auth.uid()
  and role = 'Owner'
  and exists (
    select 1 from public.workspaces
    where id = workspace_id and owner_id = auth.uid()
  )
);
create policy members_admin_write on public.workspace_members for update
  using (public.can_manage_member(workspace_id, user_id))
  with check (public.can_manage_member_update(workspace_id, user_id, role, status));
create policy members_owner_delete on public.workspace_members for delete using (public.is_workspace_owner(workspace_id) and role <> 'Owner');

create policy clients_member_select on public.clients for select using (public.is_workspace_member(workspace_id));
create policy clients_admin_write on public.clients for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create policy projects_member_select on public.projects for select using (public.is_workspace_member(workspace_id));
create policy projects_admin_write on public.projects for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create policy project_members_member_select on public.project_members for select using (
  exists (select 1 from public.projects where id = project_id and public.is_workspace_member(workspace_id))
);
create policy project_members_admin_write on public.project_members for all using (
  exists (select 1 from public.projects where id = project_id and public.is_workspace_admin(workspace_id))
) with check (
  exists (select 1 from public.projects where id = project_id and public.is_workspace_admin(workspace_id))
);

create policy invitations_admin_select on public.workspace_invitations for select using (public.is_workspace_admin(workspace_id));
create policy invitations_admin_insert on public.workspace_invitations for insert with check (public.is_workspace_admin(workspace_id) and invited_by = auth.uid());
create policy invitations_admin_update on public.workspace_invitations for update using (public.is_workspace_admin(workspace_id));

create policy entries_scope_select on public.time_entries for select using (
  user_id = auth.uid() or public.is_workspace_admin(workspace_id)
);
create policy entries_owner_insert on public.time_entries for insert with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
create policy entries_owner_update on public.time_entries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy entries_owner_delete on public.time_entries for delete using (user_id = auth.uid());

create policy timers_owner on public.active_timers for all using (user_id = auth.uid()) with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = 1048576;

create policy avatar_select on storage.objects for select using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy avatar_insert on storage.objects for insert with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy avatar_update on storage.objects for update using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy avatar_delete on storage.objects for delete using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
