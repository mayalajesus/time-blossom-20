insert into public.user_preferences (user_id, avatar_data_url)
select
  profile.id,
  case substr(md5(profile.id), 1, 1)
    when '0' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg'
    when '1' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg'
    when '2' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg'
    when '3' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg'
    when '4' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg'
    when '5' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg'
    when '6' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg'
    when '7' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg'
    when '8' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg'
    when '9' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg'
    when 'a' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg'
    when 'b' then 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg'
    else 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg'
  end
from public.profiles profile
on conflict (user_id) do update
  set avatar_data_url = coalesce(nullif(public.user_preferences.avatar_data_url, ''), excluded.avatar_data_url),
      updated_at = now();
