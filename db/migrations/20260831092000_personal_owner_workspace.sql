create or replace function public.ensure_personal_workspace(p_user_id text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  workspace_id uuid;
begin
  if p_user_id is null or btrim(p_user_id) = '' then
    raise exception 'A user id is required to create a personal workspace.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('time-blossom:personal-workspace:' || p_user_id, 0)
  );

  select w.id
    into workspace_id
    from public.workspaces w
   where w.owner_id = p_user_id
     and w.status = 'active'
   order by w.created_at asc, w.id asc
   limit 1;

  if workspace_id is null then
    insert into public.workspaces (name, owner_id, status)
    values ('Workspace pessoal', p_user_id, 'active')
    returning id into workspace_id;
  end if;

  return workspace_id;
end;
$$;

do $$
declare
  profile_id text;
begin
  for profile_id in
    select p.id
      from public.profiles p
     where not exists (
       select 1
         from public.workspaces w
        where w.owner_id = p.id
          and w.status = 'active'
     )
  loop
    perform public.ensure_personal_workspace(profile_id);
  end loop;
end;
$$;
