create or replace function public.auth_display_name(metadata jsonb, fallback_email text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(btrim(concat_ws(
      ' ',
      nullif(btrim(coalesce(metadata ->> 'given_name', metadata ->> 'first_name', metadata ->> 'firstName', '')), ''),
      nullif(btrim(coalesce(metadata ->> 'family_name', metadata ->> 'last_name', metadata ->> 'lastName', '')), '')
    )), ''),
    nullif(btrim(metadata ->> 'full_name'), ''),
    nullif(btrim(metadata ->> 'name'), ''),
    nullif(btrim(metadata ->> 'displayName'), ''),
    split_part(coalesce(fallback_email, ''), '@', 1),
    ''
  );
$$;

create or replace function public.google_avatar_url(metadata jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(metadata ->> 'avatar_url', metadata ->> 'picture', '')
      ~ '^https://([^.]+\.)*googleusercontent\.com/'
    then coalesce(metadata ->> 'avatar_url', metadata ->> 'picture')
    else null
  end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text := public.auth_display_name(new.raw_user_meta_data, new.email);
  google_avatar text := public.google_avatar_url(new.raw_user_meta_data);
begin
  insert into public.profiles (id, auth_issuer, name, email, initials)
  values (
    new.id::text,
    'supabase',
    display_name,
    lower(coalesce(new.email, '')),
    upper(left(regexp_replace(display_name, '[^[:alnum:]]', '', 'g'), 2))
  )
  on conflict (id) do update
    set auth_issuer = 'supabase',
        email = excluded.email,
        name = case when profiles.name = '' then excluded.name else profiles.name end,
        initials = case when profiles.initials = '' then excluded.initials else profiles.initials end,
        updated_at = now();

  insert into public.user_preferences (user_id, avatar_data_url)
  values (new.id::text, google_avatar)
  on conflict (user_id) do update
    set avatar_data_url = case
          when excluded.avatar_data_url is not null
            and (
              user_preferences.avatar_data_url is null
              or user_preferences.avatar_data_url = ''
              or user_preferences.avatar_data_url like 'https://heroui-assets.%'
            )
          then excluded.avatar_data_url
          else user_preferences.avatar_data_url
        end,
        updated_at = now();

  return new;
end;
$$;

update public.profiles profile
set name = public.auth_display_name(auth_user.raw_user_meta_data, auth_user.email),
    email = lower(coalesce(auth_user.email, profile.email)),
    initials = upper(left(regexp_replace(
      public.auth_display_name(auth_user.raw_user_meta_data, auth_user.email),
      '[^[:alnum:]]',
      '',
      'g'
    ), 2)),
    updated_at = now()
from auth.users auth_user
where profile.id = auth_user.id::text
  and (
    profile.name = ''
    or profile.name = split_part(coalesce(auth_user.email, ''), '@', 1)
  );

update public.user_preferences preferences
set avatar_data_url = public.google_avatar_url(auth_user.raw_user_meta_data),
    updated_at = now()
from auth.users auth_user
where preferences.user_id = auth_user.id::text
  and public.google_avatar_url(auth_user.raw_user_meta_data) is not null
  and (
    preferences.avatar_data_url is null
    or preferences.avatar_data_url = ''
    or preferences.avatar_data_url like 'https://heroui-assets.%'
  );
