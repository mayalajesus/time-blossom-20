alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists deletion_requested_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_account_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check
      check (account_status in ('active', 'deletion_pending'));
  end if;
end $$;

create table if not exists public.api_rate_limits (
  user_id text not null references public.profiles (id) on delete cascade,
  scope text not null check (scope in ('general', 'read', 'sync', 'sensitive', 'export')),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, scope)
);

create table if not exists public.legal_acceptances (
  user_id text not null references public.profiles (id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  locale text not null default 'pt-BR' check (locale in ('pt-BR', 'en-US')),
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version, privacy_version)
);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  subject_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  execute_after timestamptz not null default (now() + interval '30 days'),
  cancelled_at timestamptz,
  completed_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_error text,
  updated_at timestamptz not null default now()
);

create unique index if not exists account_deletion_one_open_request_idx
  on public.account_deletion_requests (user_id)
  where user_id is not null and status in ('pending', 'processing', 'failed');

create index if not exists account_deletion_due_idx
  on public.account_deletion_requests (execute_after)
  where status in ('pending', 'failed');

alter table public.api_rate_limits enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.account_deletion_requests enable row level security;

comment on table public.api_rate_limits is
  'Server-only persistent counters used to protect authenticated API operations.';
comment on table public.legal_acceptances is
  'Versioned proof that a user accepted the Terms and Privacy Notice.';
comment on table public.account_deletion_requests is
  'Server-only, retryable 30-day account deletion queue.';

create or replace function public.handle_new_profile_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.auth_issuer is distinct from 'deleted' then
    perform public.ensure_personal_workspace(new.id);
  end if;
  return new;
end;
$$;
