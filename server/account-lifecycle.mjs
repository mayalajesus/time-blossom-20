import { createHash } from "node:crypto";
import { DataApiError } from "./data-api-error.mjs";

export const TERMS_VERSION = "2026-09-03";
export const PRIVACY_VERSION = "2026-09-03";
export const ACCOUNT_DELETION_DAYS = 30;

function uuid(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new DataApiError(400, "The data payload contains an invalid identifier.");
  }
  return value;
}

function subjectHash(userId) {
  return createHash("sha256").update(userId).digest("hex");
}

export async function getAccountDeletionStatus(client, userId) {
  const profile = await client.query(
    `select account_status, deletion_requested_at
       from public.profiles where id = $1 limit 1`,
    [userId],
  );
  const acceptance = await client.query(
    `select accepted_at
       from public.legal_acceptances
      where user_id = $1 and terms_version = $2 and privacy_version = $3
      limit 1`,
    [userId, TERMS_VERSION, PRIVACY_VERSION],
  );
  const deletion = await client.query(
    `select id::text, status, requested_at, execute_after, cancelled_at, completed_at
       from public.account_deletion_requests
      where user_id = $1
      order by requested_at desc
      limit 1`,
    [userId],
  );
  const blockers = await client.query(
    `select w.id::text, w.name,
            count(*) filter (where member.status = 'active' and member.user_id <> $1)::integer
              as other_active_members
       from public.workspaces w
       left join public.workspace_members member on member.workspace_id = w.id
      where w.owner_id = $1 and w.status = 'active'
      group by w.id, w.name
     having count(*) filter (where member.status = 'active' and member.user_id <> $1) > 0
      order by w.name`,
    [userId],
  );
  const row = deletion.rows[0];
  return {
    accountStatus: profile.rows[0]?.account_status ?? "active",
    legal: {
      accepted: Boolean(acceptance.rowCount),
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      acceptedAt: acceptance.rows[0]?.accepted_at?.toISOString?.() ?? null,
    },
    deletion: row
      ? {
          id: row.id,
          status: row.status,
          requestedAt: new Date(row.requested_at).toISOString(),
          executeAfter: new Date(row.execute_after).toISOString(),
          cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
          completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
        }
      : null,
    ownershipBlockers: blockers.rows.map((item) => ({
      workspaceId: item.id,
      workspaceName: item.name,
      otherActiveMembers: Number(item.other_active_members),
    })),
  };
}

export async function acceptLegalTerms(client, userId, locale) {
  const acceptedLocale = locale === "en-US" ? "en-US" : "pt-BR";
  await client.query(
    `insert into public.legal_acceptances
       (user_id, terms_version, privacy_version, locale)
     values ($1, $2, $3, $4)
     on conflict (user_id, terms_version, privacy_version) do nothing`,
    [userId, TERMS_VERSION, PRIVACY_VERSION, acceptedLocale],
  );
  return getAccountDeletionStatus(client, userId);
}

export async function enforceAccountLifecycle(client, userId, operation) {
  const result = await client.query(
    `select p.account_status,
            exists (
              select 1 from public.legal_acceptances acceptance
               where acceptance.user_id = p.id
                 and acceptance.terms_version = $2
                 and acceptance.privacy_version = $3
            ) as legal_accepted
       from public.profiles p where p.id = $1`,
    [userId, TERMS_VERSION, PRIVACY_VERSION],
  );
  if (!result.rowCount) return;
  const state = result.rows[0];
  const deletionAllowed = new Set([
    "getAccountDeletionStatus",
    "cancelAccountDeletion",
    "exportAccountData",
  ]);
  if (state.account_status === "deletion_pending" && !deletionAllowed.has(operation)) {
    throw new DataApiError(423, "Your account is scheduled for deletion.", {
      code: "account_deletion_pending",
    });
  }
  const legalAllowed = new Set([
    "loadAccount",
    "getAccountDeletionStatus",
    "acceptLegalTerms",
    "exportAccountData",
    "requestAccountDeletion",
  ]);
  if (!state.legal_accepted && !legalAllowed.has(operation)) {
    throw new DataApiError(451, "Accept the current Terms and Privacy Notice to continue.", {
      code: "legal_acceptance_required",
    });
  }
}

export async function transferWorkspaceOwnership(client, userId, body) {
  const workspaceId = uuid(body.workspaceId);
  const targetUserId = String(body.targetUserId ?? "").trim();
  if (!targetUserId || targetUserId === userId) {
    throw new DataApiError(400, "Choose another active workspace member.");
  }
  const workspace = await client.query(
    `select owner_id from public.workspaces where id = $1 for update`,
    [workspaceId],
  );
  if (!workspace.rowCount) throw new DataApiError(404, "This workspace no longer exists.");
  if (workspace.rows[0].owner_id !== userId) {
    throw new DataApiError(403, "Only the workspace Owner can transfer ownership.");
  }
  const target = await client.query(
    `select 1 from public.workspace_members
      where workspace_id = $1 and user_id = $2 and status = 'active' and role <> 'Owner'`,
    [workspaceId, targetUserId],
  );
  if (!target.rowCount) throw new DataApiError(400, "Choose an active workspace member.");

  await client.query(
    `update public.workspace_members set role = 'Admin'
      where workspace_id = $1 and user_id = $2`,
    [workspaceId, userId],
  );
  await client.query(
    `update public.workspace_members set role = 'Owner'
      where workspace_id = $1 and user_id = $2`,
    [workspaceId, targetUserId],
  );
  await client.query(`update public.workspaces set owner_id = $2 where id = $1`, [
    workspaceId,
    targetUserId,
  ]);
  return { workspaceId, ownerId: targetUserId };
}

export async function exportAccountData(client, user) {
  const [profile, preferences, memberships, invitations, entries] = await Promise.all([
    client.query(
      `select id, name, email, initials, created_at, updated_at from public.profiles where id = $1`,
      [user.id],
    ),
    client.query(
      `select language, theme, timezone, idle_detection, active_workspace_id::text,
              report_filters, updated_at
         from public.user_preferences where user_id = $1`,
      [user.id],
    ),
    client.query(
      `select member.workspace_id::text, workspace.name as workspace_name, member.role,
              member.status, member.hourly_rate, member.currency, member.invited_at, member.joined_at
         from public.workspace_members member
         join public.workspaces workspace on workspace.id = member.workspace_id
        where member.user_id = $1 order by workspace.created_at`,
      [user.id],
    ),
    client.query(
      `select id::text, workspace_id::text, email, role, status, invited_at, expires_at, accepted_at
         from public.workspace_invitations
        where invited_by = $1 or lower(email) = lower($2)
        order by invited_at`,
      [user.id, user.email],
    ),
    client.query(
      `select id::text, workspace_id::text, date::text, start_time::text, end_time::text,
              end_date::text, start_at, end_at, duration_seconds, project_id::text, task,
              description, billable, hourly_rate, currency, created_at, updated_at
         from public.time_entries where user_id = $1 order by created_at`,
      [user.id],
    ),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile.rows[0] ?? null,
    preferences: preferences.rows[0] ?? null,
    memberships: memberships.rows,
    invitations: invitations.rows,
    timeEntries: entries.rows,
  };
}

export async function requestAccountDeletion(client, user, body) {
  const confirmation = String(body.confirmation ?? "")
    .trim()
    .toLowerCase();
  if (!user.email || confirmation !== user.email.trim().toLowerCase()) {
    throw new DataApiError(400, "Type your account email to confirm deletion.");
  }
  if (!user.authenticatedAt || Date.now() - user.authenticatedAt > 10 * 60_000) {
    throw new DataApiError(401, "Sign in again before requesting account deletion.", {
      code: "recent_authentication_required",
    });
  }
  const blockers = await client.query(
    `select w.name
       from public.workspaces w
      where w.owner_id = $1 and w.status = 'active'
        and exists (
          select 1 from public.workspace_members member
           where member.workspace_id = w.id and member.user_id <> $1 and member.status = 'active'
        )`,
    [user.id],
  );
  if (blockers.rowCount) {
    throw new DataApiError(
      409,
      "Transfer ownership of every shared workspace before deleting your account.",
      { code: "workspace_ownership_transfer_required" },
    );
  }
  const result = await client.query(
    `insert into public.account_deletion_requests (user_id, subject_hash)
     values ($1, $2)
     on conflict (user_id) where user_id is not null and status in ('pending', 'processing', 'failed')
     do update set status = 'pending', execute_after = now() + interval '30 days',
                   requested_at = now(), cancelled_at = null, last_error = null, updated_at = now()
     returning id::text, status, requested_at, execute_after`,
    [user.id, subjectHash(user.id)],
  );
  await client.query(
    `update public.profiles
        set account_status = 'deletion_pending', deletion_requested_at = now(), updated_at = now()
      where id = $1`,
    [user.id],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    status: row.status,
    requestedAt: new Date(row.requested_at).toISOString(),
    executeAfter: new Date(row.execute_after).toISOString(),
  };
}

export async function cancelAccountDeletion(client, userId) {
  const cancelled = await client.query(
    `update public.account_deletion_requests
        set status = 'cancelled', cancelled_at = now(), updated_at = now()
      where user_id = $1 and status in ('pending', 'failed')
      returning id`,
    [userId],
  );
  if (!cancelled.rowCount) {
    throw new DataApiError(409, "This deletion request can no longer be cancelled.");
  }
  await client.query(
    `update public.profiles
        set account_status = 'active', deletion_requested_at = null, updated_at = now()
      where id = $1`,
    [userId],
  );
  return null;
}

async function removePrivateMedia(admin, avatarPath, logos) {
  if (avatarPath) {
    const result = await admin.storage.from("avatars").remove([avatarPath]);
    if (result.error && !/not found/i.test(result.error.message)) throw result.error;
  }
  if (logos.length) {
    const result = await admin.storage.from("workspace-logos").remove(logos);
    if (result.error && !/not found/i.test(result.error.message)) throw result.error;
  }
}

async function processDeletion(pool, admin, request) {
  const userId = request.user_id;
  const client = await pool.connect();
  try {
    const media = await client.query(
      `select profile.avatar_path,
              coalesce(array_agg(workspace.logo_path) filter (where workspace.logo_path is not null), '{}') as logos
         from public.profiles profile
         left join public.workspaces workspace on workspace.owner_id = profile.id
        where profile.id = $1
        group by profile.avatar_path`,
      [userId],
    );
    if (admin && media.rowCount) {
      await removePrivateMedia(admin, media.rows[0].avatar_path, media.rows[0].logos ?? []);
    }

    await client.query("begin");
    const sharedOwned = await client.query(
      `select w.name from public.workspaces w
        where w.owner_id = $1 and exists (
          select 1 from public.workspace_members member
           where member.workspace_id = w.id and member.user_id <> $1 and member.status = 'active'
        ) for update`,
      [userId],
    );
    if (sharedOwned.rowCount) {
      throw new Error("Workspace ownership must be transferred before deletion.");
    }
    const pseudonymId = `deleted:${request.id}`;
    const sharedEntries = await client.query(
      `select distinct entry.workspace_id::text
         from public.time_entries entry
         join public.workspaces workspace on workspace.id = entry.workspace_id
        where entry.user_id = $1 and workspace.owner_id <> $1`,
      [userId],
    );
    if (sharedEntries.rowCount) {
      await client.query(
        `insert into public.profiles (id, auth_issuer, name, email, initials)
         values ($1, 'deleted', 'Usuário excluído', '', 'UE')
         on conflict (id) do nothing`,
        [pseudonymId],
      );
      for (const row of sharedEntries.rows) {
        await client.query(
          `insert into public.workspace_members
             (workspace_id, user_id, role, status, joined_at)
           values ($1, $2, 'Member', 'removed', now())
           on conflict (workspace_id, user_id) do nothing`,
          [row.workspace_id, pseudonymId],
        );
      }
      await client.query(
        `update public.time_entries entry set user_id = $2, updated_at = now()
          from public.workspaces workspace
         where entry.workspace_id = workspace.id and entry.user_id = $1 and workspace.owner_id <> $1`,
        [userId, pseudonymId],
      );
      await client.query(
        `update public.workspace_invitations set invited_by = $2 where invited_by = $1`,
        [userId, pseudonymId],
      );
    } else {
      await client.query(`delete from public.workspace_invitations where invited_by = $1`, [
        userId,
      ]);
    }
    await client.query(`delete from public.workspaces where owner_id = $1`, [userId]);
    await client.query(`delete from public.workspace_members where user_id = $1`, [userId]);
    await client.query(`delete from public.profiles where id = $1`, [userId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (admin) {
    const result = await admin.auth.admin.deleteUser(userId, false);
    if (result.error && !/not found/i.test(result.error.message)) throw result.error;
  }
  await pool.query(
    `update public.account_deletion_requests
        set user_id = null, status = 'completed', completed_at = now(), last_error = null, updated_at = now()
      where id = $1`,
    [request.id],
  );
}

export async function processDueAccountDeletions(pool, admin, limit = 25) {
  const due = await pool.query(
    `select id::text, user_id
       from public.account_deletion_requests
      where user_id is not null
        and execute_after <= now()
        and (
          status in ('pending', 'failed')
          or (status = 'processing' and updated_at < now() - interval '1 hour')
        )
      order by execute_after
      limit $1`,
    [Math.min(25, Math.max(1, Number(limit) || 25))],
  );
  let completed = 0;
  let failed = 0;
  for (const request of due.rows) {
    const claimed = await pool.query(
      `update public.account_deletion_requests
          set status = 'processing', updated_at = now()
        where id = $1 and (
          status in ('pending', 'failed')
          or (status = 'processing' and updated_at < now() - interval '1 hour')
        ) returning id`,
      [request.id],
    );
    if (!claimed.rowCount) continue;
    try {
      await processDeletion(pool, admin, request);
      completed += 1;
    } catch (error) {
      failed += 1;
      await pool.query(
        `update public.account_deletion_requests
            set status = 'failed', failure_count = failure_count + 1,
                last_error = left($2, 500), updated_at = now()
          where id = $1`,
        [request.id, error instanceof Error ? error.message : "Deletion failed"],
      );
    }
  }
  return { selected: due.rowCount, completed, failed };
}
