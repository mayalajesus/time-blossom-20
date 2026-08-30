import { createRemoteJWKSet, jwtVerify } from "jose";
import pg from "pg";

const { Pool } = pg;
const pools = new Map();
const jwks = new Map();

function envValue(env, key) {
  return env?.[key] ?? process.env[key] ?? "";
}

function providerEnv(env) {
  return {
    databaseProvider: envValue(env, "DATABASE_PROVIDER"),
    databaseUrl: envValue(env, "DATABASE_URL"),
    neonAuthUrl: envValue(env, "VITE_NEON_AUTH_URL").replace(/\/$/, ""),
    supabaseUrl: envValue(env, "VITE_SUPABASE_URL").replace(/\/$/, ""),
    supabasePublishableKey: envValue(env, "VITE_SUPABASE_PUBLISHABLE_KEY"),
  };
}

function getPool(config) {
  if (!config.databaseUrl) throw new Error("DATABASE_URL is required by the data API.");
  let pool = pools.get(config.databaseUrl);
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 5,
      application_name: "time-blossom-api",
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

function numberValue(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

async function authenticate(request, config) {
  const authorization = request.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new Error("Authentication is required.");

  if (config.databaseProvider === "supabase") {
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      throw new Error("Supabase authentication is not configured.");
    }
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.supabasePublishableKey, authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("The authentication token is invalid or expired.");
    const user = await response.json();
    return {
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.displayName ?? user.user_metadata?.name ?? "",
    };
  }

  if (config.databaseProvider !== "neon" || !config.neonAuthUrl) {
    throw new Error("Neon authentication is not configured.");
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
  const verified = await jwtVerify(token, keySet);
  if (!verified.payload.sub) throw new Error("The authentication token has no user subject.");
  return {
    id: verified.payload.sub,
    email: typeof verified.payload.email === "string" ? verified.payload.email : "",
    name: typeof verified.payload.name === "string" ? verified.payload.name : "",
  };
}

async function ensureProfile(client, user, config) {
  const name = user.name.trim().replace(/\s+/g, " ");
  const email = user.email.trim().toLowerCase();
  if (!name || name.split(" ").length < 2) {
    throw new Error("A first and last name are required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email is required.");
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

async function loadAccount(client, user, config) {
  await ensureProfile(client, user, config);
  const workspaces = await client.query(
    `select w.id::text, w.name, w.owner_id, w.status, w.created_at, w.archived_at
       from public.workspaces w
       join public.workspace_members access on access.workspace_id = w.id
      where access.user_id = $1
      order by w.created_at asc`,
    [user.id],
  );
  const workspaceIds = workspaces.rows.map((row) => row.id);
  const identityRows = await client.query(
    `select distinct p.id, p.name, p.email, p.initials
       from public.profiles p
       join public.workspace_members wm on wm.user_id = p.id
      where wm.workspace_id = any($1::uuid[]) or p.id = $2`,
    [workspaceIds, user.id],
  );
  const identityById = new Map(identityRows.rows.map((row) => [row.id, row]));
  const identities = [...identityById.values()].map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    initials: row.initials,
  }));
  const ids = identities.map((identity) => identity.id);
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
    `select id::text, workspace_id::text, date::text, start_time::text, end_time::text, end_date::text, start_at, end_at, duration_seconds, user_id, project_id::text, task, description, billable, hourly_rate, currency from public.time_entries where workspace_id = any($1::uuid[]) order by date asc, start_time asc`,
    [workspaceIds],
  );
  const preferences = await client.query(
    `select user_id, language, theme, timezone, reminders, weekly_digest, idle_detection, hourly_rate, currency from public.user_preferences where user_id = any($1::text[])`,
    [ids],
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
    list.push({
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
    });
    entriesByWorkspace.set(row.workspace_id, list);
  }
  const preferencesByUserId = Object.fromEntries(
    ids.map((id) => {
      const row = preferences.rows.find((candidate) => candidate.user_id === id);
      return [
        id,
        {
          reminders: row?.reminders ?? true,
          weeklyDigest: row?.weekly_digest ?? false,
          idleDetection: row?.idle_detection ?? true,
          language: row?.language === "pt-BR" ? "pt-BR" : "en-US",
          theme: row?.theme === "light" || row?.theme === "dark" ? row.theme : "system",
          avatarUrl: null,
          timezone: row?.timezone ?? "UTC",
          hourlyRate: numberValue(row?.hourly_rate),
          currency: ["BRL", "USD", "EUR", "GBP"].includes(row?.currency) ? row.currency : "USD",
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
        logoDataUrl: null,
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

async function syncAccount(client, user, config, account) {
  if (!account || !Array.isArray(account.identities) || !Array.isArray(account.workspaces))
    throw new Error("Invalid account payload.");
  await ensureProfile(client, user, config);
  const identities = account.identities.filter((item) => item && typeof item.id === "string");
  for (const identity of identities) {
    await client.query(
      `insert into public.profiles (id, auth_issuer, name, email, initials)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set name = excluded.name, email = excluded.email, initials = excluded.initials, updated_at = now()`,
      [
        identity.id,
        config.databaseProvider,
        String(identity.name ?? ""),
        String(identity.email ?? ""),
        String(identity.initials ?? "?"),
      ],
    );
    const preferences = account.preferencesByUserId?.[identity.id];
    if (preferences) {
      await client.query(
        `insert into public.user_preferences (user_id, language, theme, timezone, reminders, weekly_digest, idle_detection, hourly_rate, currency)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (user_id) do update set language = excluded.language, theme = excluded.theme, timezone = excluded.timezone, reminders = excluded.reminders, weekly_digest = excluded.weekly_digest, idle_detection = excluded.idle_detection, hourly_rate = excluded.hourly_rate, currency = excluded.currency, updated_at = now()`,
        [
          identity.id,
          preferences.language,
          preferences.theme,
          preferences.timezone,
          preferences.reminders,
          preferences.weeklyDigest,
          preferences.idleDetection,
          numberValue(preferences.hourlyRate),
          preferences.currency,
        ],
      );
    }
  }
  for (const data of account.workspaces) {
    const workspaceId = uuid(data.workspace.id);
    const ownerId = String(data.workspace.ownerId);
    const existingWorkspace = await client.query(
      `select owner_id from public.workspaces where id = $1`,
      [workspaceId],
    );
    if (existingWorkspace.rows[0]) {
      const access = await client.query(
        `select 1 from public.workspace_members where workspace_id = $1 and user_id = $2 limit 1`,
        [workspaceId, user.id],
      );
      if (!access.rowCount || existingWorkspace.rows[0].owner_id !== ownerId) {
        throw new Error("You do not have permission to update this workspace.");
      }
    } else if (ownerId !== user.id) {
      throw new Error("Only the authenticated user can create a workspace.");
    }
    await client.query(
      `insert into public.workspaces (id, name, owner_id, status, created_at, archived_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set name = excluded.name, owner_id = excluded.owner_id, status = excluded.status, archived_at = excluded.archived_at`,
      [
        workspaceId,
        String(data.workspace.name).trim(),
        ownerId,
        data.workspace.status,
        data.workspace.createdAt,
        data.workspace.archivedAt ?? null,
      ],
    );
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
    const memberships = Array.isArray(data.memberships) ? data.memberships : [];
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
      await client.query(
        `insert into public.projects (id, workspace_id, name, client_id, billable, status, color, last_activity) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do update set name = excluded.name, client_id = excluded.client_id, billable = excluded.billable, status = excluded.status, color = excluded.color, last_activity = excluded.last_activity`,
        [
          projectId,
          workspaceId,
          String(project.name).trim(),
          uuid(project.clientId),
          Boolean(project.billable),
          project.status,
          String(project.color),
          dateValue(project.lastActivity),
        ],
      );
      for (const memberId of project.memberIds ?? [])
        await client.query(
          `insert into public.project_members (workspace_id, project_id, user_id) values ($1, $2, $3) on conflict do nothing`,
          [workspaceId, projectId, memberId],
        );
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

async function operation(request, user, config, body) {
  const pool = getPool(config);
  const client = await pool.connect();
  try {
    if (body.operation === "loadAccount") return await loadAccount(client, user, config);
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
      const result = await client.query(
        `select user_id, workspace_id::text, status, task, project_id::text, billable, started_at, started_date::text, accumulated_seconds, start_clock::text, hourly_rate, currency from public.active_timers where user_id = $1 and workspace_id = $2`,
        [user.id, workspaceId],
      );
      return result.rows[0] ? timerFromRow(result.rows[0]) : null;
    }
    if (body.operation === "saveActiveTimer") {
      const timer = body.timer;
      const workspaceId = uuid(timer.workspaceId);
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
      await client.query(
        `delete from public.active_timers where user_id = $1 and workspace_id = $2`,
        [user.id, uuid(body.workspaceId)],
      );
      return null;
    }
    throw new Error("Unsupported data operation.");
  } finally {
    client.release();
  }
}

async function readBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export async function handleDataRequest(request, response, env = {}) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }
  try {
    const config = providerEnv(env);
    const user = await authenticate(request, config);
    const body = await readBody(request);
    const data = await operation(request, user, config, body);
    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ data }));
  } catch (error) {
    response.statusCode = /Authentication|token|configured|required/.test(error?.message ?? "")
      ? 401
      : 400;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error) || "The data request failed.",
      }),
    );
  }
}

export function createDataMiddleware(env = {}) {
  return (request, response) => void handleDataRequest(request, response, env);
}
