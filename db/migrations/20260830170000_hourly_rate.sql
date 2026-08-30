alter table public.user_preferences
  add column if not exists hourly_rate numeric(12, 2) not null default 0,
  add column if not exists currency text not null default 'USD';

alter table public.time_entries
  add column if not exists hourly_rate numeric(12, 2),
  add column if not exists currency text;

alter table public.active_timers
  add column if not exists hourly_rate numeric(12, 2),
  add column if not exists currency text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_hourly_rate_check'
  ) then
    alter table public.user_preferences
      add constraint user_preferences_hourly_rate_check check (hourly_rate >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_currency_check'
  ) then
    alter table public.user_preferences
      add constraint user_preferences_currency_check check (currency in ('BRL', 'USD', 'EUR', 'GBP'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'time_entries_hourly_rate_check'
  ) then
    alter table public.time_entries
      add constraint time_entries_hourly_rate_check check (hourly_rate is null or hourly_rate >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'time_entries_currency_check'
  ) then
    alter table public.time_entries
      add constraint time_entries_currency_check
      check (currency is null or currency in ('BRL', 'USD', 'EUR', 'GBP'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'active_timers_hourly_rate_check'
  ) then
    alter table public.active_timers
      add constraint active_timers_hourly_rate_check check (hourly_rate is null or hourly_rate >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'active_timers_currency_check'
  ) then
    alter table public.active_timers
      add constraint active_timers_currency_check
      check (currency is null or currency in ('BRL', 'USD', 'EUR', 'GBP'));
  end if;
end
$$;
