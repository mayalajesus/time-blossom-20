create or replace function public.requesting_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function public.requesting_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1),
    ''
  );
begin
  insert into public.profiles (id, auth_issuer, name, email, initials)
  values (
    new.id::text,
    'supabase',
    display_name,
    coalesce(new.email, ''),
    upper(left(regexp_replace(display_name, '[^[:alnum:]]', '', 'g'), 2))
  )
  on conflict (id) do update
    set email = excluded.email,
        name = case when profiles.name = '' then excluded.name else profiles.name end,
        initials = case when profiles.initials = '' then excluded.initials else profiles.initials end,
        updated_at = now();

  insert into public.user_preferences (user_id)
  values (new.id::text)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = coalesce(new.email, ''), updated_at = now()
  where id = new.id::text;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_updated();

insert into public.profiles (id, auth_issuer, name, email, initials)
select
  auth_user.id::text,
  'supabase',
  coalesce(
    auth_user.raw_user_meta_data ->> 'full_name',
    auth_user.raw_user_meta_data ->> 'name',
    split_part(auth_user.email, '@', 1),
    ''
  ),
  coalesce(auth_user.email, ''),
  upper(left(regexp_replace(
    coalesce(
      auth_user.raw_user_meta_data ->> 'full_name',
      auth_user.raw_user_meta_data ->> 'name',
      split_part(auth_user.email, '@', 1),
      ''
    ),
    '[^[:alnum:]]',
    '',
    'g'
  ), 2))
from auth.users auth_user
on conflict (id) do update
  set email = excluded.email, updated_at = now();

insert into public.user_preferences (user_id)
select id::text from auth.users
on conflict (user_id) do nothing;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = public.requesting_user_id()
      and status = 'active'
  );
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = public.requesting_user_id()
      and status = 'active'
      and role in ('Admin', 'Owner')
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = public.requesting_user_id()
      and status = 'active'
      and role = 'Owner'
  );
$$;

create or replace function public.can_manage_member(target_workspace uuid, target_user text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_role text;
  target_role text;
begin
  select role into actor_role
  from public.workspace_members
  where workspace_id = target_workspace
    and user_id = public.requesting_user_id()
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
  target_user text,
  next_role text,
  next_status text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_role text;
  target_role text;
begin
  select role into actor_role
  from public.workspace_members
  where workspace_id = target_workspace
    and user_id = public.requesting_user_id()
    and status = 'active';

  select role into target_role
  from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user;

  if actor_role = 'Owner' then
    return target_role <> 'Owner'
      and next_role <> 'Owner'
      and next_status in ('active', 'invited', 'removed');
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
security definer
set search_path = public
as $$
declare
  invitation public.workspace_invitations%rowtype;
  current_user_id text := public.requesting_user_id();
  current_email text := public.requesting_user_email();
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
    where id = invitation.workspace_id and status = 'archived'
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

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    status,
    invited_at,
    joined_at
  )
  values (
    invitation.workspace_id,
    current_user_id,
    invitation.role,
    'active',
    invitation.invited_at,
    now()
  )
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        invited_at = excluded.invited_at,
        joined_at = excluded.joined_at;

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

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = public.requesting_user_id()
  or exists (
    select 1
    from public.workspace_members viewer
    join public.workspace_members target on target.workspace_id = viewer.workspace_id
    where viewer.user_id = public.requesting_user_id()
      and viewer.status = 'active'
      and target.user_id = profiles.id
      and target.status = 'active'
  )
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = public.requesting_user_id())
  with check (id = public.requesting_user_id());

drop policy if exists preferences_owner on public.user_preferences;
create policy preferences_owner on public.user_preferences for all
  using (user_id = public.requesting_user_id())
  with check (user_id = public.requesting_user_id());

drop policy if exists workspaces_member_select on public.workspaces;
create policy workspaces_member_select on public.workspaces for select
  using (public.is_workspace_member(id));

drop policy if exists workspaces_owner_insert on public.workspaces;
create policy workspaces_owner_insert on public.workspaces for insert
  with check (owner_id = public.requesting_user_id());

drop policy if exists workspaces_owner_update on public.workspaces;
create policy workspaces_owner_update on public.workspaces for update
  using (owner_id = public.requesting_user_id())
  with check (owner_id = public.requesting_user_id());

drop policy if exists workspace_settings_member_select on public.workspace_settings;
create policy workspace_settings_member_select on public.workspace_settings for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_settings_admin_write on public.workspace_settings;
create policy workspace_settings_admin_write on public.workspace_settings for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists members_self_insert on public.workspace_members;
create policy members_self_insert on public.workspace_members for insert with check (
  user_id = public.requesting_user_id()
  and role = 'Owner'
  and exists (
    select 1 from public.workspaces
    where id = workspace_id and owner_id = public.requesting_user_id()
  )
);

drop policy if exists members_admin_write on public.workspace_members;
create policy members_admin_write on public.workspace_members for update
  using (public.can_manage_member(workspace_id, user_id))
  with check (public.can_manage_member_update(workspace_id, user_id, role, status));

drop policy if exists members_owner_delete on public.workspace_members;
create policy members_owner_delete on public.workspace_members for delete
  using (public.is_workspace_owner(workspace_id) and role <> 'Owner');

drop policy if exists clients_member_select on public.clients;
create policy clients_member_select on public.clients for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists clients_admin_write on public.clients;
create policy clients_admin_write on public.clients for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists projects_member_select on public.projects;
create policy projects_member_select on public.projects for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists projects_admin_write on public.projects;
create policy projects_admin_write on public.projects for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists project_members_member_select on public.project_members;
create policy project_members_member_select on public.project_members for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists project_members_admin_write on public.project_members;
create policy project_members_admin_write on public.project_members for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists invitations_admin_select on public.workspace_invitations;
create policy invitations_admin_select on public.workspace_invitations for select
  using (public.is_workspace_admin(workspace_id));

drop policy if exists invitations_admin_insert on public.workspace_invitations;
create policy invitations_admin_insert on public.workspace_invitations for insert
  with check (
    public.is_workspace_admin(workspace_id)
    and invited_by = public.requesting_user_id()
  );

drop policy if exists invitations_admin_update on public.workspace_invitations;
create policy invitations_admin_update on public.workspace_invitations for update
  using (public.is_workspace_admin(workspace_id));

drop policy if exists entries_scope_select on public.time_entries;
create policy entries_scope_select on public.time_entries for select
  using (
    user_id = public.requesting_user_id()
    or public.is_workspace_admin(workspace_id)
  );

drop policy if exists entries_owner_insert on public.time_entries;
create policy entries_owner_insert on public.time_entries for insert
  with check (
    user_id = public.requesting_user_id()
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists entries_owner_update on public.time_entries;
create policy entries_owner_update on public.time_entries for update
  using (user_id = public.requesting_user_id())
  with check (user_id = public.requesting_user_id());

drop policy if exists entries_owner_delete on public.time_entries;
create policy entries_owner_delete on public.time_entries for delete
  using (user_id = public.requesting_user_id());

drop policy if exists timers_owner on public.active_timers;
create policy timers_owner on public.active_timers for all
  using (user_id = public.requesting_user_id())
  with check (
    user_id = public.requesting_user_id()
    and public.is_workspace_member(workspace_id)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 1048576,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatar_select on storage.objects;
create policy avatar_select on storage.objects for select using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = public.requesting_user_id()
);

drop policy if exists avatar_insert on storage.objects;
create policy avatar_insert on storage.objects for insert with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = public.requesting_user_id()
);

drop policy if exists avatar_update on storage.objects;
create policy avatar_update on storage.objects for update using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = public.requesting_user_id()
);

drop policy if exists avatar_delete on storage.objects;
create policy avatar_delete on storage.objects for delete using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = public.requesting_user_id()
);
