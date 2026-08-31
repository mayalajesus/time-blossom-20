insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    false,
    1048576,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'workspace-logos',
    'workspace-logos',
    false,
    1048576,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatar_select on storage.objects;
create policy avatar_select on storage.objects for select using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = public.requesting_user_id()
    or exists (
      select 1
      from public.workspace_members viewer
      join public.workspace_members target on target.workspace_id = viewer.workspace_id
      where viewer.user_id = public.requesting_user_id()
        and viewer.status = 'active'
        and target.user_id = (storage.foldername(name))[1]
        and target.status = 'active'
    )
  )
);

drop policy if exists workspace_logo_select on storage.objects;
create policy workspace_logo_select on storage.objects for select using (
  bucket_id = 'workspace-logos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists workspace_logo_insert on storage.objects;
create policy workspace_logo_insert on storage.objects for insert with check (
  bucket_id = 'workspace-logos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.is_workspace_owner(((storage.foldername(name))[1])::uuid)
);

drop policy if exists workspace_logo_update on storage.objects;
create policy workspace_logo_update on storage.objects for update
  using (
    bucket_id = 'workspace-logos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'workspace-logos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists workspace_logo_delete on storage.objects;
create policy workspace_logo_delete on storage.objects for delete using (
  bucket_id = 'workspace-logos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.is_workspace_owner(((storage.foldername(name))[1])::uuid)
);
