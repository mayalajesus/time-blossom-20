create unique index if not exists projects_workspace_client_name_idx
  on public.projects (
    workspace_id,
    client_id,
    lower(regexp_replace(trim(name), E'\\s+', ' ', 'g'))
  );
