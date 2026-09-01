alter table public.workspace_members
  add column if not exists hourly_rate numeric(12, 2),
  add column if not exists currency text;

update public.workspace_members wm
set hourly_rate = coalesce(wm.hourly_rate, greatest(up.hourly_rate, 0), 0),
    currency = coalesce(
      wm.currency,
      case
        when up.currency in ('BRL', 'USD', 'EUR', 'GBP') then up.currency
        else null
      end,
      'USD'
    )
from public.user_preferences up
where up.user_id = wm.user_id
  and (wm.hourly_rate is null or wm.currency is null);

update public.workspace_members
set hourly_rate = coalesce(hourly_rate, 0),
    currency = coalesce(currency, 'USD')
where hourly_rate is null or currency is null;

alter table public.workspace_members
  alter column hourly_rate set default 0,
  alter column hourly_rate set not null,
  alter column currency set default 'USD',
  alter column currency set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_hourly_rate_check'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_hourly_rate_check check (hourly_rate >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_currency_check'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_currency_check
      check (currency in ('BRL', 'USD', 'EUR', 'GBP'));
  end if;
end
$$;
