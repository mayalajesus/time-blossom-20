import { createRemoteJWKSet, jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { Pool } = pg;
const pools = new Map();
const jwks = new Map();
const supabaseAdmins = new Map();
const defaultAvatarUrls = [
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg",
];

class DataApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "DataApiError";
    this.status = status;
  }
}

function envValue(env, key) {
  return env?.[key] ?? process.env[key] ?? "";
}

function providerEnv(env) {
  const databaseProvider = envValue(env, "DATABASE_PROVIDER");
  const vercelUrl = envValue(env, "VERCEL_URL");
  return {
    databaseProvider,
    databaseUrl:
      envValue(env, "DATABASE_URL") ||
      (databaseProvider === "supabase" ? envValue(env, "SUPABASE_DATABASE_URL") : ""),
    appUrl:
      envValue(env, "APP_URL") ||
      envValue(env, "VITE_APP_URL") ||
      (vercelUrl ? `https://${vercelUrl}` : ""),
    neonAuthUrl: envValue(env, "VITE_NEON_AUTH_URL").replace(/\/$/, ""),
    supabaseUrl: (envValue(env, "SUPABASE_URL") || envValue(env, "VITE_SUPABASE_URL")).replace(
      /\/$/,
      "",
    ),
    supabasePublishableKey:
      envValue(env, "SUPABASE_ANON_KEY") || envValue(env, "VITE_SUPABASE_PUBLISHABLE_KEY"),
    supabaseServiceRoleKey: envValue(env, "SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function getSupabaseAdmin(config) {
  if (
    config.databaseProvider !== "supabase" ||
    !config.supabaseUrl ||
    !config.supabaseServiceRoleKey
  ) {
    throw new DataApiError(500, "Supabase server credentials are not configured.");
  }
  const cacheKey = `${config.supabaseUrl}:${config.supabaseServiceRoleKey.slice(-8)}`;
  let admin = supabaseAdmins.get(cacheKey);
  if (!admin) {
    admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    supabaseAdmins.set(cacheKey, admin);
  }
  return admin;
}

function getPool(config) {
  if (!config.databaseUrl) throw new Error("DATABASE_URL is required by the data API.");
  let pool = pools.get(config.databaseUrl);
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 5,
      application_name: "watchtag-api",
    });
    pools.set(config.databaseUrl, pool);
  }
  return pool;
}

function uuid(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error("The data payload contains an invalid identifier.");
  }
  return value;
}

function dateValue(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error("The data payload contains an invalid date.");
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value ? new Date(value).toISOString() : null;
}

function timeValue(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) {
    throw new Error("The data payload contains an invalid time.");
  }
  return value;
}

function normalizeProjectName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function ensureProjectNameAvailable(client, workspaceId, clientId, name, projectId = null) {
  const result = await client.query(
    `select 1
       from public.projects
      where workspace_id = $1
        and client_id = $2
        and lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) = $3
        and ($4::uuid is null or id <> $4::uuid)
      limit 1`,
    [workspaceId, clientId, normalizeProjectName(name), projectId],
  );
  if (result.rows[0]) {
    throw new DataApiError(409, "A project with this name already exists for this client.");
  }
}

function numberValue(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function avatarDataValue(value) {
  if (typeof value !== "string") return null;
  if (
    /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=\r\n]+$/.test(value) &&
    value.length <= 1_500_000
  )
    return value;
  return defaultAvatarUrls.includes(value) ? value : null;
}

function defaultAvatarForUser(userId) {
  let hash = 0;
  for (const character of userId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return defaultAvatarUrls[hash % defaultAvatarUrls.length];
}

function invitationMember(row) {
  const name = String(row.email ?? "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return {
    id: row.id,
    name: name || "Invited user",
    email: row.email,
    initials,
    role: row.role,
    status: "invited",
    invitedAt: iso(row.invited_at),
  };
}

async function signedStorageUrl(config, bucket, path) {
  if (!path || config.databaseProvider !== "supabase") return null;
  const { data, error } = await getSupabaseAdmin(config)
    .storage.from(bucket)
    .createSignedUrl(path, 60 * 60 * 24);
  if (error) throw new DataApiError(500, `Could not load ${bucket} media.`);
  return data.signedUrl;
}

function parseImageDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=\r\n]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength > 1_048_576) {
    throw new DataApiError(400, "The image must be smaller than 1 MB.");
  }
  return { bytes, contentType: match[1] };
}

function reportFiltersValue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

async function hasColumn(client, tableName, columnName) {
  const result = await client.query(
    `select exists (
       select 1
         from information_schema.columns
        where table_schema = 'public' and table_name = $1 and column_name = $2
     ) as present`,
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.present);
}

async function authenticate(request, config) {
  const authorization = request.headers?.authorization ?? request.headers?.Authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new DataApiError(401, "Authentication is required.");

  if (config.databaseProvider === "supabase") {
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      throw new DataApiError(500, "Supabase authentication is not configured.");
    }
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.supabasePublishableKey, authorization: `Bearer ${token}` },
    });
    if (!response.ok)
      throw new DataApiError(401, "The authentication token is invalid or expired.");
    const user = await response.json();
    return {
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.displayName ?? user.user_metadata?.name ?? "",
    };
  }

  if (config.databaseProvider !== "neon" || !config.neonAuthUrl) {
    throw new DataApiError(500, "Neon authentication is not configured.");
  }
  const sessionResult = await getPool(config).query(
    `select u.id::text, u.email, u.name
       from neon_auth.session s
       join neon_auth."user" u on u.id = s."userId"
      where s.token = $1 and s."expiresAt" > now()
      limit 1`,
    [token],
  );
  if (sessionResult.rows[0]) {
    return {
      id: sessionResult.rows[0].id,
      email: sessionResult.rows[0].email ?? "",
      name: sessionResult.rows[0].name ?? "",
    };
  }
  let keySet = jwks.get(config.neonAuthUrl);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${config.neonAuthUrl}/.well-known/jwks.json`));
    jwks.set(config.neonAuthUrl, keySet);
  }
  let verified;
  try {
    verified = await jwtVerify(token, keySet);
  } catch {
    throw new DataApiError(401, "The authentication token is invalid or expired.");
  }
  if (!verified.payload.sub)
    throw new DataApiError(401, "The authentication token has no user subject.");
  return {
    id: verified.payload.sub,
    email: typeof verified.payload.email === "string" ? verified.payload.email : "",
    name: typeof verified.payload.name === "string" ? verified.payload.name : "",
  };
}

async function workspaceAccess(client, userId, workspaceId) {
  const result = await client.query(
    `select w.status, w.owner_id, wm.role, wm.status as membership_status
       from public.workspace_members wm
       join public.workspaces w on w.id = wm.workspace_id
      where wm.workspace_id = $1 and wm.user_id = $2
      limit 1`,
    [workspaceId, userId],
  );
  return result.rows[0] ?? null;
}

async function requireWorkspaceAccess(client, userId, workspaceId, allowArchived = false) {
  const access = await workspaceAccess(client, userId, workspaceId);
  if (!access || access.membership_status !== "active") {
    throw new DataApiError(403, "You do not have access to this workspace.");
  }
  if (!allowArchived && access.status !== "active") {
    throw new DataApiError(403, "Archived workspaces are read-only.");
  }
  return access;
}

function requirePayloadUser(user, body) {
  if (body.userId !== undefined && body.userId !== user.id) {
    throw new DataApiError(403, "The authenticated user does not match the request.");
  }
}

async function ensureProfile(client, user, config) {
  const existingProfile = await client.query(
    `select name, email from public.profiles where id = $1 limit 1`,
    [user.id],
  );
  const storedProfile = existingProfile.rows[0];
  const authenticatedName = user.name.trim().replace(/\s+/g, " ");
  const authenticatedEmail = user.email.trim().toLowerCase();
  const name =
    authenticatedName && authenticatedName.split(" ").length >= 2
      ? authenticatedName
      : String(storedProfile?.name ?? "")
          .trim()
          .replace(/\s+/g, " ");
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authenticatedEmail)
    ? authenticatedEmail
    : String(storedProfile?.email ?? "")
        .trim()
        .toLowerCase();
  if (!name || name.split(" ").length < 2) {
    throw new DataApiError(400, "A first and last name are required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DataApiError(400, "A valid email is required.");
  }
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") ||
    (user.email[0]?.toUpperCase() ?? "?");
  await client.query(
    `insert into public.profiles (id, auth_issuer, name, email, initials)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do update set
       auth_issuer = excluded.auth_issuer,
       email = case when excluded.email <> '' then excluded.email else profiles.email end,
       name = case when profiles.name = '' and excluded.name <> '' then excluded.name else profiles.name end,
       initials = case when profiles.initials = '' and excluded.initials <> '' then excluded.initials else profiles.initials end,
       updated_at = now()`,
    [user.id, config.databaseProvider, name, email, initials],
  );
  await client.query(
    `insert into public.user_preferences (user_id) values ($1) on conflict (user_id) do nothing`,
    [user.id],
  );
  await client.query(`select public.ensure_personal_workspace($1)`, [user.id]);
}

function emptyTrello() {
  return {
    status: "disconnected",
    workspace: null,
    board: null,
    lists: [],
    cards: [],
    rule: "lists",
    lastSync: null,
  };
}

function timeEntryFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
    ...(row.end_date !== row.date ? { endDate: row.end_date } : {}),
    ...(row.start_at ? { startTimestamp: new Date(row.start_at).getTime() } : {}),
    ...(row.end_at ? { endTimestamp: new Date(row.end_at).getTime() } : {}),
    seconds: row.duration_seconds,
    userId: row.user_id,
    projectId: row.project_id,
    task: row.task,
    ...(row.description ? { description: row.description } : {}),
    billable: row.billable,
    ...(row.hourly_rate !== null ? { hourlyRate: numberValue(row.hourly_rate) } : {}),
    ...(row.currency ? { currency: row.currency } : {}),
  };
}

async function loadAccount(client, user, config) {
  await ensureProfile(client, user, config);
  const hasLogoPath = await hasColumn(client, "workspaces", "logo_path");
  const hasActiveWorkspace = await hasColumn(client, "user_preferences", "active_workspace_id");
  const hasReportFilters = await hasColumn(client, "user_preferences", "report_filters");
  const workspaces = await client.query(
    `select w.id::text, w.name, w.owner_id, w.status, w.created_at, w.archived_at,
            ${hasLogoPath ? "w.logo_path" : "null::text as logo_path"}
       from public.workspaces w
       join public.workspace_members access on access.workspace_id = w.id
      where access.user_id = $1 and access.status = 'active'
      order by w.created_at asc`,
    [user.id],
  );
  const workspaceIds = workspaces.rows.map((row) => row.id);
  const identityRows = await client.query(
    `select distinct p.id, p.name, p.email, p.initials, p.avatar_path
       from public.profiles p
       join public.workspace_members wm on wm.user_id = p.id
      where wm.workspace_id = any($1::uuid[]) or p.id = $2`,
    [workspaceIds, user.id],
  );
  const invitations = await client.query(
    `select id::text, workspace_id::text, email, role, invited_at, expires_at
       from public.workspace_invitations
      where workspace_id = any($1::uuid[])
        and status = 'pending'
        and expires_at > now()
        and exists (
          select 1
            from public.workspace_members actor
           where actor.workspace_id = workspace_invitations.workspace_id
             and actor.user_id = $2
             and actor.status = 'active'
             and actor.role in ('Owner', 'Admin')
        )
      order by invited_at desc`,
    [workspaceIds, user.id],
  );
  const identityById = new Map(identityRows.rows.map((row) => [row.id, row]));
  for (const row of invitations.rows) {
    const pending = invitationMember(row);
    identityById.set(pending.id, pending);
  }
  const identities = [...identityById.values()].map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    initials: row.initials,
  }));
  const profileIds = identityRows.rows.map((identity) => identity.id);
  const memberships = await client.query(
    `select workspace_id::text, user_id, role, status, invited_at, joined_at
     from public.workspace_members where workspace_id = any($1::uuid[])`,
    [workspaceIds],
  );
  const settings = await client.query(
    `select workspace_id::text, default_billable, week_start from public.workspace_settings where workspace_id = any($1::uuid[])`,
    [workspaceIds],
  );
  const clients = await client.query(
    `select id::text, workspace_id::text, name, contact from public.clients where workspace_id = any($1::uuid[])`,
    [workspaceIds],
  );
  const projects = await client.query(
    `select id::text, workspace_id::text, name, client_id::text, billable, status, color, last_activity::text from public.projects where workspace_id = any($1::uuid[])`,
    [workspaceIds],
  );
  const projectMembers = await client.query(
    `select project_id::text, user_id from public.project_members where workspace_id = any($1::uuid[])`,
    [workspaceIds],
  );
  const entries = await client.query(
    `select id::text, workspace_id::text, date::text, start_time::text, end_time::text, end_date::text, start_at, end_at, duration_seconds, user_id, project_id::text, task, description, billable, hourly_rate, currency
       from public.time_entries e
      where e.workspace_id = any($1::uuid[])
        and (
          e.user_id = $2
          or exists (
            select 1
              from public.workspace_members viewer
             where viewer.workspace_id = e.workspace_id
               and viewer.user_id = $2
               and viewer.status = 'active'
               and viewer.role in ('Admin', 'Owner')
          )
        )
      order by date asc, start_time asc`,
    [workspaceIds, user.id],
  );
  const hasAvatarData = await hasColumn(client, "user_preferences", "avatar_data_url");
  if (hasAvatarData) {
    for (const id of profileIds) {
      await client.query(
        `insert into public.user_preferences (user_id, avatar_data_url)
         values ($1, $2)
         on conflict (user_id) do update
           set avatar_data_url = coalesce(nullif(public.user_preferences.avatar_data_url, ''), excluded.avatar_data_url),
               updated_at = now()`,
        [id, defaultAvatarForUser(id)],
      );
    }
  }
  const preferences = await client.query(
    `select user_id, language, theme, timezone, reminders, weekly_digest, idle_detection, hourly_rate, currency, ${
      hasAvatarData ? "avatar_data_url" : "null::text as avatar_data_url"
    }, ${hasActiveWorkspace ? "active_workspace_id::text" : "null::text as active_workspace_id"},
       ${hasReportFilters ? "report_filters" : "'{}'::jsonb as report_filters"}
       from public.user_preferences where user_id = any($1::text[])`,
    [profileIds],
  );
  const settingsByWorkspace = new Map(settings.rows.map((row) => [row.workspace_id, row]));
  const membershipsByWorkspace = new Map();
  for (const row of memberships.rows) {
    const list = membershipsByWorkspace.get(row.workspace_id) ?? [];
    list.push({
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      ...(row.invited_at ? { invitedAt: iso(row.invited_at) } : {}),
      ...(row.joined_at ? { joinedAt: iso(row.joined_at) } : {}),
    });
    membershipsByWorkspace.set(row.workspace_id, list);
  }
  for (const row of invitations.rows) {
    const list = membershipsByWorkspace.get(row.workspace_id) ?? [];
    list.push({
      workspaceId: row.workspace_id,
      userId: row.id,
      role: row.role,
      status: "invited",
      invitedAt: iso(row.invited_at),
    });
    membershipsByWorkspace.set(row.workspace_id, list);
  }
  const clientsByWorkspace = new Map();
  for (const row of clients.rows) {
    const list = clientsByWorkspace.get(row.workspace_id) ?? [];
    list.push({ id: row.id, name: row.name, contact: row.contact });
    clientsByWorkspace.set(row.workspace_id, list);
  }
  const memberIdsByProject = new Map();
  for (const row of projectMembers.rows) {
    const list = memberIdsByProject.get(row.project_id) ?? [];
    list.push(row.user_id);
    memberIdsByProject.set(row.project_id, list);
  }
  const projectsByWorkspace = new Map();
  for (const row of projects.rows) {
    const list = projectsByWorkspace.get(row.workspace_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      clientId: row.client_id,
      billable: row.billable,
      status: row.status,
      color: row.color,
      lastActivity: row.last_activity,
      memberIds: memberIdsByProject.get(row.id) ?? [],
    });
    projectsByWorkspace.set(row.workspace_id, list);
  }
  const entriesByWorkspace = new Map();
  for (const row of entries.rows) {
    const list = entriesByWorkspace.get(row.workspace_id) ?? [];
    list.push(timeEntryFromRow(row));
    entriesByWorkspace.set(row.workspace_id, list);
  }
  const avatarUrlsById = new Map();
  for (const row of identityRows.rows) {
    if (row.avatar_path) {
      avatarUrlsById.set(row.id, await signedStorageUrl(config, "avatars", row.avatar_path));
    }
  }
  const logoUrlsByWorkspaceId = new Map();
  for (const row of workspaces.rows) {
    if (row.logo_path) {
      logoUrlsByWorkspaceId.set(
        row.id,
        await signedStorageUrl(config, "workspace-logos", row.logo_path),
      );
    }
  }
  const preferencesByUserId = Object.fromEntries(
    profileIds.map((id) => {
      const row = preferences.rows.find((candidate) => candidate.user_id === id);
      const isOwnPreferences = id === user.id;
      return [
        id,
        {
          reminders: isOwnPreferences ? (row?.reminders ?? true) : true,
          weeklyDigest: isOwnPreferences ? (row?.weekly_digest ?? false) : false,
          idleDetection: isOwnPreferences ? (row?.idle_detection ?? true) : true,
          language: isOwnPreferences && row?.language === "pt-BR" ? "pt-BR" : "en-US",
          theme:
            isOwnPreferences && (row?.theme === "light" || row?.theme === "dark")
              ? row.theme
              : "system",
          avatarUrl:
            avatarUrlsById.get(id) ??
            avatarDataValue(row?.avatar_data_url) ??
            defaultAvatarForUser(id),
          timezone: isOwnPreferences ? (row?.timezone ?? "UTC") : "UTC",
          hourlyRate: numberValue(row?.hourly_rate),
          currency: ["BRL", "USD", "EUR", "GBP"].includes(row?.currency) ? row.currency : "USD",
          activeWorkspaceId: isOwnPreferences ? (row?.active_workspace_id ?? null) : null,
          reportFilters: isOwnPreferences ? reportFiltersValue(row?.report_filters) : {},
        },
      ];
    }),
  );
  return {
    version: 11,
    identities,
    workspaces: workspaces.rows.map((row) => ({
      workspace: {
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
        logoDataUrl: logoUrlsByWorkspaceId.get(row.id) ?? null,
        status: row.status,
        createdAt: iso(row.created_at),
        ...(row.archived_at ? { archivedAt: iso(row.archived_at) } : {}),
      },
      memberships: membershipsByWorkspace.get(row.id) ?? [],
      entries: entriesByWorkspace.get(row.id) ?? [],
      projects: projectsByWorkspace.get(row.id) ?? [],
      clients: clientsByWorkspace.get(row.id) ?? [],
      settings: {
        defaultBillable: settingsByWorkspace.get(row.id)?.default_billable ?? true,
        weekStart: settingsByWorkspace.get(row.id)?.week_start === "sunday" ? "sunday" : "monday",
      },
      trello: emptyTrello(),
    })),
    preferencesByUserId,
  };
}

async function loadReportEntries(client, user, body) {
  const workspaceId = uuid(body.workspaceId);
  const startDate = dateValue(body.startDate);
  const endDate = dateValue(body.endDate);
  if (endDate < startDate) {
    throw new DataApiError(400, "The report period is invalid.");
  }

  const access = await requireWorkspaceAccess(client, user.id, workspaceId);
  const result = await client.query(
    `select id::text, date::text, start_time::text, end_time::text, end_date::text,
            start_at, end_at, duration_seconds, user_id, project_id::text, task,
            description, billable, hourly_rate, currency
       from public.time_entries e
      where e.workspace_id = $1
        and (
          (e.date >= $2::date and e.date <= $3::date)
          or (e.date < $2::date and e.end_date >= $2::date)
        )
        and ($4::boolean or e.user_id = $5)
      order by e.date asc, e.start_time asc, e.id asc`,
    [workspaceId, startDate, endDate, access.role !== "Member", user.id],
  );

  return result.rows.map(timeEntryFromRow);
}

async function syncEntries(client, userId, workspaceId, entries, ownOnly) {
  if (!Array.isArray(entries)) throw new DataApiError(400, "Invalid time entries payload.");
  const entryIds = entries.map((entry) => uuid(entry.id));
  if (new Set(entryIds).size !== entryIds.length) {
    throw new DataApiError(400, "The data payload contains duplicate time entry identifiers.");
  }

  if (ownOnly) {
    await client.query(
      `delete from public.time_entries
        where workspace_id = $1 and user_id = $2 and not (id = any($3::uuid[]))`,
      [workspaceId, userId, entryIds],
    );
  } else {
    await client.query(
      `delete from public.time_entries where workspace_id = $1 and not (id = any($2::uuid[]))`,
      [workspaceId, entryIds],
    );
  }

  for (const [index, entry] of entries.entries()) {
    if (typeof entry.userId !== "string" || (ownOnly && entry.userId !== userId)) {
      throw new DataApiError(403, "You can only update your own time entries.");
    }
    const endDate = entry.endDate ?? entry.date;
    const seconds = Number(entry.seconds);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new DataApiError(400, "The data payload contains an invalid duration.");
    }
    const hourlyRate = entry.hourlyRate === undefined ? null : Number(entry.hourlyRate);
    if (hourlyRate !== null && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) {
      throw new DataApiError(400, "The data payload contains an invalid hourly rate.");
    }
    const startAt =
      typeof entry.startTimestamp === "number"
        ? new Date(entry.startTimestamp).toISOString()
        : null;
    const endAt =
      typeof entry.endTimestamp === "number" ? new Date(entry.endTimestamp).toISOString() : null;
    await client.query(
      `insert into public.time_entries (id, workspace_id, user_id, date, start_time, end_time, end_date, start_at, end_at, duration_seconds, project_id, task, description, billable, hourly_rate, currency)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       on conflict (id) do update set date = excluded.date, start_time = excluded.start_time, end_date = excluded.end_date, end_time = excluded.end_time, start_at = excluded.start_at, end_at = excluded.end_at, duration_seconds = excluded.duration_seconds, project_id = excluded.project_id, task = excluded.task, description = excluded.description, billable = excluded.billable, hourly_rate = excluded.hourly_rate, currency = excluded.currency, updated_at = now()`,
      [
        entryIds[index],
        workspaceId,
        entry.userId,
        dateValue(entry.date),
        timeValue(entry.start),
        timeValue(entry.end),
        dateValue(endDate),
        startAt,
        endAt,
        Math.floor(seconds),
        entry.projectId ? uuid(entry.projectId) : null,
        String(entry.task).trim(),
        entry.description ?? null,
        Boolean(entry.billable),
        hourlyRate,
        entry.currency ?? null,
      ],
    );
  }
}

async function syncAccount(client, user, config, account) {
  if (!account || !Array.isArray(account.identities) || !Array.isArray(account.workspaces))
    throw new DataApiError(400, "Invalid account payload.");
  await ensureProfile(client, user, config);
  const hasLogoPath = await hasColumn(client, "workspaces", "logo_path");
  const hasActiveWorkspace = await hasColumn(client, "user_preferences", "active_workspace_id");
  const hasReportFilters = await hasColumn(client, "user_preferences", "report_filters");
  const identities = new Map(
    account.identities
      .filter((item) => item && typeof item.id === "string")
      .map((identity) => [identity.id, identity]),
  );
  const ownIdentity = identities.get(user.id);
  if (!ownIdentity) throw new DataApiError(400, "The authenticated profile is missing.");
  const ownName = String(ownIdentity.name ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const ownEmail = String(ownIdentity.email ?? "")
    .trim()
    .toLowerCase();
  if (!ownName || ownName.split(" ").length < 2) {
    throw new DataApiError(400, "A first and last name are required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownEmail)) {
    throw new DataApiError(400, "A valid email is required.");
  }
  const ownInitials = ownName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  await client.query(
    `update public.profiles set name = $2, email = $3, initials = $4, updated_at = now() where id = $1`,
    [user.id, ownName, ownEmail, ownInitials],
  );
  const ownPreferences = account.preferencesByUserId?.[user.id];
  if (ownPreferences) {
    const preferenceValues = [
      user.id,
      ownPreferences.language,
      ownPreferences.theme,
      ownPreferences.timezone,
      ownPreferences.reminders,
      ownPreferences.weeklyDigest,
      ownPreferences.idleDetection,
      numberValue(ownPreferences.hourlyRate),
      ownPreferences.currency,
    ];
    await client.query(
      `insert into public.user_preferences (user_id, language, theme, timezone, reminders, weekly_digest, idle_detection, hourly_rate, currency)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (user_id) do update set language = excluded.language, theme = excluded.theme, timezone = excluded.timezone, reminders = excluded.reminders, weekly_digest = excluded.weekly_digest, idle_detection = excluded.idle_detection, hourly_rate = excluded.hourly_rate, currency = excluded.currency, updated_at = now()`,
      preferenceValues,
    );
    if (hasReportFilters) {
      await client.query(
        `update public.user_preferences set report_filters = $2::jsonb, updated_at = now() where user_id = $1`,
        [user.id, JSON.stringify(reportFiltersValue(ownPreferences.reportFilters))],
      );
    }
    if (await hasColumn(client, "user_preferences", "avatar_data_url")) {
      await client.query(
        `update public.user_preferences
            set avatar_data_url = coalesce($2, avatar_data_url), updated_at = now()
          where user_id = $1`,
        [user.id, avatarDataValue(ownPreferences.avatarUrl)],
      );
    }
  }
  for (const data of account.workspaces) {
    const workspaceId = uuid(data.workspace.id);
    const ownerId = String(data.workspace.ownerId);
    const existingWorkspace = await client.query(
      `select owner_id, name, status, ${
        hasLogoPath ? "logo_path" : "null::text as logo_path"
      } from public.workspaces where id = $1`,
      [workspaceId],
    );
    let access = existingWorkspace.rows[0]
      ? await workspaceAccess(client, user.id, workspaceId)
      : { role: "Owner", membership_status: "active", status: "active", owner_id: user.id };
    if (existingWorkspace.rows[0]) {
      if (!access || access.membership_status !== "active") {
        throw new DataApiError(403, "You do not have permission to update this workspace.");
      }
      if (existingWorkspace.rows[0].owner_id !== ownerId) {
        throw new DataApiError(403, "The workspace owner cannot be changed.");
      }
      if (
        access.role !== "Owner" &&
        (data.workspace.name !== existingWorkspace.rows[0].name ||
          data.workspace.status !== existingWorkspace.rows[0].status)
      ) {
        throw new DataApiError(403, "Only the workspace Owner can edit it.");
      }
    } else if (ownerId !== user.id || access.role !== "Owner") {
      throw new DataApiError(403, "Only the authenticated user can create a workspace.");
    }
    if (existingWorkspace.rows[0] && access.status === "archived" && access.role !== "Owner") {
      continue;
    }
    let logoPath = existingWorkspace.rows[0]?.logo_path ?? null;
    if (hasLogoPath && access.role === "Owner" && config.databaseProvider === "supabase") {
      const image = parseImageDataUrl(data.workspace.logoDataUrl);
      if (image) {
        logoPath = `${workspaceId}/logo`;
        const { error } = await getSupabaseAdmin(config)
          .storage.from("workspace-logos")
          .upload(logoPath, image.bytes, { contentType: image.contentType, upsert: true });
        if (error) throw new DataApiError(500, "Could not save the workspace logo.");
      } else if (data.workspace.logoDataUrl === null && logoPath) {
        const { error } = await getSupabaseAdmin(config)
          .storage.from("workspace-logos")
          .remove([logoPath]);
        if (error) throw new DataApiError(500, "Could not remove the workspace logo.");
        logoPath = null;
      }
    }
    if (access.role !== "Member") {
      const workspaceValues = [
        workspaceId,
        String(data.workspace.name).trim(),
        ownerId,
        data.workspace.status,
        data.workspace.createdAt,
        data.workspace.archivedAt ?? null,
      ];
      if (hasLogoPath) {
        await client.query(
          `insert into public.workspaces (id, name, owner_id, status, created_at, archived_at, logo_path)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (id) do update set name = excluded.name, owner_id = excluded.owner_id, status = excluded.status, archived_at = excluded.archived_at, logo_path = excluded.logo_path`,
          [...workspaceValues, logoPath],
        );
      } else {
        await client.query(
          `insert into public.workspaces (id, name, owner_id, status, created_at, archived_at)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (id) do update set name = excluded.name, owner_id = excluded.owner_id, status = excluded.status, archived_at = excluded.archived_at`,
          workspaceValues,
        );
      }
      await client.query(
        `insert into public.workspace_settings (workspace_id, default_billable, week_start)
         values ($1, $2, $3)
         on conflict (workspace_id) do update set default_billable = excluded.default_billable, week_start = excluded.week_start, updated_at = now()`,
        [
          workspaceId,
          data.settings?.defaultBillable ?? true,
          data.settings?.weekStart === "sunday" ? "sunday" : "monday",
        ],
      );
    }
    const memberships = Array.isArray(data.memberships)
      ? data.memberships.filter((membership) => membership?.status !== "invited")
      : [];
    if (access.role === "Member") {
      await syncEntries(client, user.id, workspaceId, data.entries ?? [], true);
      continue;
    }
    const membershipByUserId = new Map();
    for (const membership of memberships) {
      if (!membership || typeof membership.userId !== "string") {
        throw new DataApiError(400, "Invalid workspace membership payload.");
      }
      if (
        !["Owner", "Admin", "Member"].includes(membership.role) ||
        !["active", "invited", "removed"].includes(membership.status)
      ) {
        throw new DataApiError(400, "Invalid workspace membership payload.");
      }
      membershipByUserId.set(membership.userId, membership);
      const identity = identities.get(membership.userId);
      if (!identity) throw new DataApiError(400, "A workspace member profile is missing.");
      const existingMembership = await client.query(
        `select role, status from public.workspace_members where workspace_id = $1 and user_id = $2`,
        [workspaceId, membership.userId],
      );
      const previousMembership = existingMembership.rows[0];
      if (membership.userId !== user.id) {
        const existingProfile = await client.query(`select 1 from public.profiles where id = $1`, [
          membership.userId,
        ]);
        if (!existingProfile.rowCount) {
          await client.query(
            `insert into public.profiles (id, auth_issuer, name, email, initials) values ($1, $2, $3, $4, $5)`,
            [
              membership.userId,
              config.databaseProvider,
              String(identity.name ?? "Invited user"),
              String(identity.email ?? ""),
              String(identity.initials ?? "IU"),
            ],
          );
        }
      }
      if (
        membership.role === "Owner" &&
        (membership.userId !== ownerId || membership.status !== "active")
      ) {
        throw new DataApiError(400, "A workspace must have one active Owner.");
      }
      if (
        access.role === "Admin" &&
        membership.userId !== user.id &&
        (membership.role === "Owner" ||
          (previousMembership?.role === "Owner" && membership.role !== "Owner") ||
          (previousMembership?.role === "Admin" &&
            (membership.role !== "Admin" || membership.status !== previousMembership.status)))
      ) {
        throw new DataApiError(403, "Admins cannot manage Owners or Admins.");
      }
    }
    const ownerMembership = membershipByUserId.get(ownerId);
    if (
      !ownerMembership ||
      ownerMembership.role !== "Owner" ||
      ownerMembership.status !== "active"
    ) {
      throw new DataApiError(400, "A workspace must have one active Owner.");
    }
    if (!membershipByUserId.has(user.id) || membershipByUserId.get(user.id).status !== "active") {
      throw new DataApiError(403, "You cannot remove your own workspace access.");
    }
    const existingMemberships = await client.query(
      `select user_id, role from public.workspace_members where workspace_id = $1`,
      [workspaceId],
    );
    for (const existingMembership of existingMemberships.rows) {
      if (membershipByUserId.has(existingMembership.user_id)) continue;
      if (
        existingMembership.role === "Owner" ||
        (access.role === "Admin" && existingMembership.role === "Admin")
      ) {
        throw new DataApiError(403, "You cannot remove this workspace member.");
      }
    }
    await client.query(
      `delete from public.time_entries where workspace_id = $1 and not (id = any($2::uuid[]))`,
      [workspaceId, (data.entries ?? []).map((entry) => uuid(entry.id))],
    );
    await client.query(`delete from public.project_members where workspace_id = $1`, [workspaceId]);
    await client.query(
      `delete from public.projects where workspace_id = $1 and not (id = any($2::uuid[]))`,
      [workspaceId, (data.projects ?? []).map((project) => uuid(project.id))],
    );
    await client.query(
      `delete from public.clients where workspace_id = $1 and not (id = any($2::uuid[]))`,
      [workspaceId, (data.clients ?? []).map((item) => uuid(item.id))],
    );
    await client.query(
      `delete from public.workspace_members where workspace_id = $1 and not (user_id = any($2::text[]))`,
      [workspaceId, memberships.map((item) => String(item.userId))],
    );
    for (const membership of memberships) {
      await client.query(
        `insert into public.workspace_members (workspace_id, user_id, role, status, invited_at, joined_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (workspace_id, user_id) do update set role = excluded.role, status = excluded.status, invited_at = excluded.invited_at, joined_at = excluded.joined_at`,
        [
          workspaceId,
          membership.userId,
          membership.role,
          membership.status,
          membership.invitedAt ?? null,
          membership.joinedAt ?? null,
        ],
      );
    }
    for (const item of data.clients ?? []) {
      await client.query(
        `insert into public.clients (id, workspace_id, name, contact) values ($1, $2, $3, $4) on conflict (id) do update set name = excluded.name, contact = excluded.contact`,
        [uuid(item.id), workspaceId, String(item.name).trim(), String(item.contact ?? "")],
      );
    }
    for (const project of data.projects ?? []) {
      const projectId = uuid(project.id);
      const projectName = String(project.name ?? "")
        .trim()
        .replace(/\s+/g, " ");
      if (!projectName) throw new DataApiError(400, "A project name is required.");
      const clientId = uuid(project.clientId);
      await ensureProjectNameAvailable(client, workspaceId, clientId, projectName, projectId);
      await client.query(
        `insert into public.projects (id, workspace_id, name, client_id, billable, status, color, last_activity) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do update set name = excluded.name, client_id = excluded.client_id, billable = excluded.billable, status = excluded.status, color = excluded.color, last_activity = excluded.last_activity`,
        [
          projectId,
          workspaceId,
          projectName,
          clientId,
          Boolean(project.billable),
          project.status,
          String(project.color),
          dateValue(project.lastActivity),
        ],
      );
      for (const memberId of project.memberIds ?? []) {
        if (membershipByUserId.get(memberId)?.status !== "active") {
          throw new DataApiError(400, "Only active members can be assigned to a project.");
        }
        await client.query(
          `insert into public.project_members (workspace_id, project_id, user_id) values ($1, $2, $3) on conflict do nothing`,
          [workspaceId, projectId, memberId],
        );
      }
    }
    for (const entry of data.entries ?? []) {
      const endDate = entry.endDate ?? entry.date;
      await client.query(
        `insert into public.time_entries (id, workspace_id, user_id, date, start_time, end_time, end_date, start_at, end_at, duration_seconds, project_id, task, description, billable, hourly_rate, currency)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         on conflict (id) do update set date = excluded.date, start_time = excluded.start_time, end_time = excluded.end_time, end_date = excluded.end_date, start_at = excluded.start_at, end_at = excluded.end_at, duration_seconds = excluded.duration_seconds, project_id = excluded.project_id, task = excluded.task, description = excluded.description, billable = excluded.billable, hourly_rate = excluded.hourly_rate, currency = excluded.currency, updated_at = now()`,
        [
          uuid(entry.id),
          workspaceId,
          entry.userId,
          dateValue(entry.date),
          timeValue(entry.start),
          timeValue(entry.end),
          dateValue(endDate),
          typeof entry.startTimestamp === "number"
            ? new Date(entry.startTimestamp).toISOString()
            : null,
          typeof entry.endTimestamp === "number"
            ? new Date(entry.endTimestamp).toISOString()
            : null,
          Math.floor(entry.seconds),
          entry.projectId ? uuid(entry.projectId) : null,
          String(entry.task).trim(),
          entry.description ?? null,
          Boolean(entry.billable),
          entry.hourlyRate ?? null,
          entry.currency ?? null,
        ],
      );
    }
  }
  if (ownPreferences && hasActiveWorkspace) {
    const requestedWorkspaceId = ownPreferences.activeWorkspaceId
      ? uuid(ownPreferences.activeWorkspaceId)
      : null;
    const preferred = requestedWorkspaceId
      ? await client.query(
          `select 1
             from public.workspace_members wm
             join public.workspaces w on w.id = wm.workspace_id
            where wm.workspace_id = $1 and wm.user_id = $2
              and wm.status = 'active' and w.status = 'active'`,
          [requestedWorkspaceId, user.id],
        )
      : { rowCount: 0 };
    await client.query(
      `update public.user_preferences
          set active_workspace_id = $2, updated_at = now()
        where user_id = $1`,
      [user.id, preferred.rowCount ? requestedWorkspaceId : null],
    );
  }
}

function timerFromRow(row) {
  return {
    status: row.status,
    workspaceId: row.workspace_id,
    task: row.task,
    projectId: row.project_id,
    billable: row.billable,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    startedDate: row.started_date,
    accumulated: row.accumulated_seconds,
    startClock: row.start_clock.slice(0, 5),
    ...(row.hourly_rate !== null ? { hourlyRate: numberValue(row.hourly_rate) } : {}),
    ...(row.currency ? { currency: row.currency } : {}),
  };
}

async function requireInvitationManager(client, userId, workspaceId, targetRole) {
  const access = await requireWorkspaceAccess(client, userId, workspaceId);
  if (access.role !== "Owner" && access.role !== "Admin") {
    throw new DataApiError(403, "You do not have permission to manage invitations.");
  }
  if (targetRole === "Admin" && access.role !== "Owner") {
    throw new DataApiError(403, "Only the Owner can manage Admin invitations.");
  }
  return access;
}

function invitationRedirect(config, invitationId) {
  if (!config.appUrl) throw new DataApiError(500, "APP_URL is required to send invitations.");
  let redirect;
  try {
    redirect = new URL("/invite/accept", config.appUrl);
  } catch {
    throw new DataApiError(500, "APP_URL is invalid.");
  }
  redirect.searchParams.set("invitation", invitationId);
  return redirect.toString();
}

async function sendInvitation(config, invitation) {
  const admin = getSupabaseAdmin(config);
  const options = {
    redirectTo: invitationRedirect(config, invitation.id),
    data: { invitation_id: invitation.id },
  };
  const { error } = await admin.auth.admin.inviteUserByEmail(invitation.email, options);
  if (!error) return;
  const existingUser =
    error.code === "email_exists" ||
    /already (?:been )?registered|already exists/i.test(error.message);
  if (!existingUser) throw new DataApiError(400, error.message);
  const { error: magicLinkError } = await admin.auth.signInWithOtp({
    email: invitation.email,
    options: {
      emailRedirectTo: options.redirectTo,
      data: options.data,
      shouldCreateUser: false,
    },
  });
  if (magicLinkError) throw new DataApiError(400, magicLinkError.message);
}

async function inviteMember(client, user, config, body) {
  if (config.databaseProvider !== "supabase") {
    throw new DataApiError(400, "Invitations require the Supabase production provider.");
  }
  await ensureProfile(client, user, config);
  const workspaceId = uuid(body.workspaceId);
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const role = body.role === "Admin" ? "Admin" : body.role === "Member" ? "Member" : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !role) {
    throw new DataApiError(400, "Enter a valid invitation email and role.");
  }
  await requireInvitationManager(client, user.id, workspaceId, role);
  const existing = await client.query(
    `select 1
       from public.workspace_members wm
       join public.profiles p on p.id = wm.user_id
      where wm.workspace_id = $1 and lower(p.email) = $2
      limit 1`,
    [workspaceId, email],
  );
  if (existing.rowCount) {
    throw new DataApiError(409, "This email is already part of the team.");
  }
  await client.query(
    `update public.workspace_invitations
        set status = 'expired'
      where workspace_id = $1 and lower(email) = $2
        and status = 'pending' and expires_at <= now()`,
    [workspaceId, email],
  );
  const capacity = await client.query(
    `select
       (select count(*) from public.workspace_members where workspace_id = $1 and status <> 'removed')
       +
       (select count(*) from public.workspace_invitations where workspace_id = $1 and status = 'pending' and expires_at > now())
       as total`,
    [workspaceId],
  );
  if (numberValue(capacity.rows[0]?.total) >= 50) {
    throw new DataApiError(
      409,
      "This workspace has reached its limit of 50 members and invitations.",
    );
  }
  let inserted;
  try {
    inserted = await client.query(
      `insert into public.workspace_invitations (workspace_id, email, role, invited_by)
       values ($1, $2, $3, $4)
       returning id::text, workspace_id::text, email, role, invited_at, expires_at`,
      [workspaceId, email, role, user.id],
    );
  } catch (error) {
    if (error?.code === "23505") {
      throw new DataApiError(409, "This email already has a pending invitation.");
    }
    throw error;
  }
  const invitation = inserted.rows[0];
  try {
    await sendInvitation(config, invitation);
  } catch (error) {
    await client.query(
      `update public.workspace_invitations set status = 'cancelled' where id = $1`,
      [invitation.id],
    );
    throw error;
  }
  return invitationMember(invitation);
}

async function resendInvitation(client, user, config, body) {
  const workspaceId = uuid(body.workspaceId);
  const invitationId = uuid(body.invitationId);
  const result = await client.query(
    `select id::text, workspace_id::text, email, role, invited_at, expires_at
       from public.workspace_invitations
      where id = $1 and workspace_id = $2 and status = 'pending' and expires_at > now()`,
    [invitationId, workspaceId],
  );
  const invitation = result.rows[0];
  if (!invitation) throw new DataApiError(404, "This invitation is no longer pending.");
  await requireInvitationManager(client, user.id, workspaceId, invitation.role);
  await sendInvitation(config, invitation);
  const updated = await client.query(
    `update public.workspace_invitations
        set invited_at = now(), expires_at = now() + interval '7 days'
      where id = $1
      returning id::text, workspace_id::text, email, role, invited_at, expires_at`,
    [invitationId],
  );
  return invitationMember(updated.rows[0]);
}

async function cancelInvitation(client, user, body) {
  const workspaceId = uuid(body.workspaceId);
  const invitationId = uuid(body.invitationId);
  const result = await client.query(
    `select id::text, role
       from public.workspace_invitations
      where id = $1 and workspace_id = $2 and status = 'pending'`,
    [invitationId, workspaceId],
  );
  const invitation = result.rows[0];
  if (!invitation) throw new DataApiError(404, "This invitation is no longer pending.");
  await requireInvitationManager(client, user.id, workspaceId, invitation.role);
  await client.query(`update public.workspace_invitations set status = 'cancelled' where id = $1`, [
    invitationId,
  ]);
  return null;
}

async function updatePreferences(client, user, config, body) {
  const patch = body.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new DataApiError(400, "Invalid preferences payload.");
  }
  const allowedKeys = new Set([
    "reminders",
    "weeklyDigest",
    "idleDetection",
    "language",
    "theme",
    "avatarUrl",
    "timezone",
    "hourlyRate",
    "currency",
    "activeWorkspaceId",
    "reportFilters",
  ]);
  if (Object.keys(patch).some((key) => !allowedKeys.has(key))) {
    throw new DataApiError(400, "Invalid preferences payload.");
  }
  await ensureProfile(client, user, config);
  const updates = [];
  const values = [user.id];
  const addValue = (column, value, cast = "") => {
    values.push(value);
    updates.push(`${column} = $${values.length}${cast}`);
  };
  if (patch.reminders !== undefined) {
    if (typeof patch.reminders !== "boolean")
      throw new DataApiError(400, "Choose a valid reminders preference.");
    addValue("reminders", patch.reminders);
  }
  if (patch.weeklyDigest !== undefined) {
    if (typeof patch.weeklyDigest !== "boolean")
      throw new DataApiError(400, "Choose a valid weekly digest preference.");
    addValue("weekly_digest", patch.weeklyDigest);
  }
  if (patch.idleDetection !== undefined) {
    if (typeof patch.idleDetection !== "boolean")
      throw new DataApiError(400, "Choose a valid idle detection preference.");
    addValue("idle_detection", patch.idleDetection);
  }
  if (patch.language !== undefined) {
    if (patch.language !== "en-US" && patch.language !== "pt-BR")
      throw new DataApiError(400, "Choose a valid language.");
    addValue("language", patch.language);
  }
  if (patch.theme !== undefined) {
    if (!["system", "light", "dark"].includes(patch.theme))
      throw new DataApiError(400, "Choose a valid theme.");
    addValue("theme", patch.theme);
  }
  if (patch.timezone !== undefined) {
    if (typeof patch.timezone !== "string" || !patch.timezone.trim())
      throw new DataApiError(400, "Choose a valid timezone.");
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: patch.timezone }).format();
    } catch {
      throw new DataApiError(400, "Choose a valid timezone.");
    }
    addValue("timezone", patch.timezone);
  }
  if (patch.hourlyRate !== undefined) {
    const hourlyRate = Number(patch.hourlyRate);
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0)
      throw new DataApiError(400, "Choose a valid hourly rate.");
    addValue("hourly_rate", hourlyRate);
  }
  if (patch.currency !== undefined) {
    if (!["BRL", "USD", "EUR", "GBP"].includes(patch.currency))
      throw new DataApiError(400, "Choose a valid currency.");
    addValue("currency", patch.currency);
  }
  if (
    patch.reportFilters !== undefined &&
    (await hasColumn(client, "user_preferences", "report_filters"))
  ) {
    if (
      !patch.reportFilters ||
      typeof patch.reportFilters !== "object" ||
      Array.isArray(patch.reportFilters)
    ) {
      throw new DataApiError(400, "Choose valid report filters.");
    }
    addValue("report_filters", JSON.stringify(patch.reportFilters), "::jsonb");
  }
  if (
    patch.activeWorkspaceId !== undefined &&
    (await hasColumn(client, "user_preferences", "active_workspace_id"))
  ) {
    const workspaceId = patch.activeWorkspaceId === null ? null : uuid(patch.activeWorkspaceId);
    if (workspaceId) await requireWorkspaceAccess(client, user.id, workspaceId);
    addValue("active_workspace_id", workspaceId, "::uuid");
  }
  if (updates.length === 0) return null;
  await client.query(
    `update public.user_preferences
        set ${updates.join(", ")}, updated_at = now()
      where user_id = $1`,
    values,
  );
  return null;
}

async function operation(request, user, config, body) {
  const pool = getPool(config);
  const client = await pool.connect();
  try {
    requirePayloadUser(user, body ?? {});
    if (body.operation === "loadAccount") return await loadAccount(client, user, config);
    if (body.operation === "loadReportEntries") return await loadReportEntries(client, user, body);
    if (body.operation === "updatePreferences")
      return await updatePreferences(client, user, config, body);
    if (body.operation === "inviteMember") return await inviteMember(client, user, config, body);
    if (body.operation === "resendInvitation")
      return await resendInvitation(client, user, config, body);
    if (body.operation === "cancelInvitation") return await cancelInvitation(client, user, body);
    if (body.operation === "syncAccount") {
      await client.query("begin");
      try {
        await syncAccount(client, user, config, body.account);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
      return null;
    }
    if (body.operation === "getActiveTimer") {
      const workspaceId = uuid(body.workspaceId);
      await requireWorkspaceAccess(client, user.id, workspaceId);
      const result = await client.query(
        `select user_id, workspace_id::text, status, task, project_id::text, billable, started_at, started_date::text, accumulated_seconds, start_clock::text, hourly_rate, currency from public.active_timers where user_id = $1 and workspace_id = $2`,
        [user.id, workspaceId],
      );
      return result.rows[0] ? timerFromRow(result.rows[0]) : null;
    }
    if (body.operation === "saveActiveTimer") {
      const timer = body.timer;
      if (!timer || typeof timer !== "object") {
        throw new DataApiError(400, "Invalid timer payload.");
      }
      const workspaceId = uuid(timer.workspaceId);
      const access = await requireWorkspaceAccess(client, user.id, workspaceId);
      if (timer.status !== "running" && timer.status !== "paused") {
        throw new DataApiError(400, "Invalid timer status.");
      }
      if (typeof timer.task !== "string" || !timer.task.trim()) {
        throw new DataApiError(400, "A task is required.");
      }
      if (!Number.isFinite(Number(timer.accumulated)) || Number(timer.accumulated) < 0) {
        throw new DataApiError(400, "The data payload contains an invalid timer duration.");
      }
      if (timer.projectId) {
        const projectId = uuid(timer.projectId);
        const project = await client.query(
          `select p.status,
                  exists (
                    select 1 from public.project_members pm
                    where pm.project_id = p.id and pm.workspace_id = p.workspace_id and pm.user_id = $2
                  ) as assigned
             from public.projects p
            where p.id = $1 and p.workspace_id = $3`,
          [projectId, user.id, workspaceId],
        );
        if (!project.rows[0]) throw new DataApiError(400, "This project no longer exists.");
        if (project.rows[0].status !== "active") {
          throw new DataApiError(400, "This project cannot be used for a timer.");
        }
        if (access.role === "Member" && !project.rows[0].assigned) {
          throw new DataApiError(403, "This project is not assigned to your team member.");
        }
      }
      const result = await client.query(
        `insert into public.active_timers (user_id, workspace_id, status, task, project_id, billable, started_at, started_date, accumulated_seconds, start_clock, hourly_rate, currency) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) on conflict (user_id, workspace_id) do update set status = excluded.status, task = excluded.task, project_id = excluded.project_id, billable = excluded.billable, started_at = excluded.started_at, started_date = excluded.started_date, accumulated_seconds = excluded.accumulated_seconds, start_clock = excluded.start_clock, hourly_rate = excluded.hourly_rate, currency = excluded.currency, updated_at = now() returning user_id, workspace_id::text, status, task, project_id::text, billable, started_at, started_date::text, accumulated_seconds, start_clock::text, hourly_rate, currency`,
        [
          user.id,
          workspaceId,
          timer.status,
          String(timer.task).trim(),
          timer.projectId ? uuid(timer.projectId) : null,
          Boolean(timer.billable),
          timer.startedAt ? new Date(timer.startedAt).toISOString() : null,
          timer.startedDate ? dateValue(timer.startedDate) : null,
          Math.floor(timer.accumulated),
          timeValue(timer.startClock),
          timer.hourlyRate ?? null,
          timer.currency ?? null,
        ],
      );
      return timerFromRow(result.rows[0]);
    }
    if (body.operation === "clearActiveTimer") {
      const workspaceId = uuid(body.workspaceId);
      await requireWorkspaceAccess(client, user.id, workspaceId, true);
      await client.query(
        `delete from public.active_timers where user_id = $1 and workspace_id = $2`,
        [user.id, workspaceId],
      );
      return null;
    }
    throw new DataApiError(400, "Unsupported data operation.");
  } finally {
    client.release();
  }
}

async function readBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  let raw = "";
  for await (const chunk of request) raw += chunk;
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new DataApiError(400, "The request body must be valid JSON.");
  }
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store, private");
  response.end(JSON.stringify(payload));
}

export async function handleDataRequest(request, response, env = {}) {
  const method = String(request.method ?? "").toUpperCase();
  if (method === "OPTIONS") {
    response.statusCode = 204;
    response.setHeader("cache-control", "no-store, private");
    response.end();
    return;
  }
  if (method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }
  try {
    const config = providerEnv(env);
    const user = await authenticate(request, config);
    const body = await readBody(request);
    const data = await operation(request, user, config, body);
    sendJson(response, 200, { data });
  } catch (error) {
    const isProjectNameConflict =
      error?.code === "23505" && error?.constraint === "projects_workspace_client_name_idx";
    const message = isProjectNameConflict
      ? "A project with this name already exists for this client."
      : error instanceof Error && error.message.trim()
        ? error.message
        : "The data request failed.";
    console.error("[watchtag data api]", {
      name: error instanceof Error ? error.name : typeof error,
      message,
      code: error?.code,
    });
    sendJson(
      response,
      isProjectNameConflict ? 409 : typeof error?.status === "number" ? error.status : 500,
      {
        error: message,
      },
    );
  }
}

export function createDataMiddleware(env = {}) {
  return (request, response) => void handleDataRequest(request, response, env);
}
