alter table public.user_preferences
  add column if not exists avatar_data_url text;
