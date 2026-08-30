do $$
begin
  if current_setting('app.environment', true) is distinct from 'qa' then
    raise exception 'QA seeds can only run with app.environment=qa.';
  end if;
end;
$$;

insert into public.profiles (id, auth_issuer, name, email, initials)
values
  ('qa|owner-0001', 'qa-fixture', 'QA Owner', 'owner@example.test', 'QO'),
  ('qa|member-0002', 'qa-fixture', 'QA Member', 'member@example.test', 'QM')
on conflict (id) do update
  set name = excluded.name,
      email = excluded.email,
      initials = excluded.initials,
      updated_at = now();

insert into public.user_preferences (user_id, language, timezone)
values
  ('qa|owner-0001', 'en-US', 'America/Sao_Paulo'),
  ('qa|member-0002', 'pt-BR', 'America/Sao_Paulo')
on conflict (user_id) do update
  set language = excluded.language,
      timezone = excluded.timezone,
      updated_at = now();

insert into public.workspaces (id, name, owner_id, status)
values (
  '10000000-0000-4000-8000-000000000001',
  'QA Time Blossom',
  'qa|owner-0001',
  'active'
)
on conflict (id) do update
  set name = excluded.name, status = 'active', archived_at = null;

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  status,
  joined_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  'qa|member-0002',
  'Member',
  'active',
  now()
)
on conflict (workspace_id, user_id) do update
  set role = excluded.role, status = excluded.status;

insert into public.clients (id, workspace_id, name, contact)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Example Client',
  'qa-client@example.test'
)
on conflict (id) do update
  set name = excluded.name, contact = excluded.contact;

insert into public.projects (
  id,
  workspace_id,
  name,
  client_id,
  billable,
  status,
  color,
  last_activity
)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'QA Website',
  '20000000-0000-4000-8000-000000000001',
  true,
  'active',
  'accent',
  date '2026-08-30'
)
on conflict (id) do update
  set name = excluded.name,
      billable = excluded.billable,
      status = excluded.status,
      last_activity = excluded.last_activity;

insert into public.project_members (workspace_id, project_id, user_id)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'qa|owner-0001'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'qa|member-0002'
  )
on conflict (project_id, user_id) do nothing;

insert into public.workspace_invitations (
  id,
  workspace_id,
  email,
  role,
  invited_by,
  status,
  expires_at
)
values (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'invitee@example.test',
  'Member',
  'qa|owner-0001',
  'pending',
  now() + interval '7 days'
)
on conflict (id) do update
  set status = 'pending', expires_at = excluded.expires_at;

insert into public.time_entries (
  id,
  workspace_id,
  user_id,
  date,
  start_time,
  end_time,
  end_date,
  start_at,
  end_at,
  duration_seconds,
  project_id,
  task,
  description,
  billable
)
values (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'qa|owner-0001',
  date '2026-08-30',
  time '09:00',
  time '10:00',
  date '2026-08-30',
  timestamptz '2026-08-30 12:00:00+00',
  timestamptz '2026-08-30 13:00:00+00',
  3600,
  '30000000-0000-4000-8000-000000000001',
  'QA fixture entry',
  'Synthetic data for homologation only.',
  true
)
on conflict (id) do update
  set task = excluded.task,
      description = excluded.description,
      duration_seconds = excluded.duration_seconds,
      updated_at = now();

insert into public.active_timers (
  user_id,
  workspace_id,
  status,
  task,
  project_id,
  billable,
  started_at,
  started_date,
  accumulated_seconds,
  start_clock
)
values (
  'qa|member-0002',
  '10000000-0000-4000-8000-000000000001',
  'paused',
  'QA paused timer',
  '30000000-0000-4000-8000-000000000001',
  true,
  null,
  date '2026-08-30',
  900,
  time '10:30'
)
on conflict (user_id, workspace_id) do update
  set status = excluded.status,
      task = excluded.task,
      project_id = excluded.project_id,
      billable = excluded.billable,
      started_at = excluded.started_at,
      started_date = excluded.started_date,
      accumulated_seconds = excluded.accumulated_seconds,
      start_clock = excluded.start_clock,
      updated_at = now();
