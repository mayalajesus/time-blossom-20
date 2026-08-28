import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    const body = await request.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role === "Admin" ? "Admin" : body.role === "Member" ? "Member" : null;
    if (!authorization || !workspaceId || !email || !role) {
      return json({ error: "Invalid invitation details." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Your session is not valid." }, 401);

    const { data: membership } = await adminClient
      .from("workspace_members")
      .select("role, status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership || (membership.role !== "Owner" && membership.role !== "Admin")) {
      return json({ error: "You do not have permission to invite members." }, 403);
    }
    if (role === "Admin" && membership.role !== "Owner") {
      return json({ error: "Only the Owner can invite Admins." }, 403);
    }

    const { data: invitation, error: invitationError } = await adminClient
      .from("workspace_invitations")
      .insert({ workspace_id: workspaceId, email, role, invited_by: userData.user.id })
      .select("id")
      .single();
    if (invitationError || !invitation)
      return json({ error: invitationError?.message ?? "Could not create invitation." }, 400);

    const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : "";
    let invitationRedirect = redirectTo;
    try {
      const url = new URL(redirectTo);
      url.searchParams.set("invitation", invitation.id);
      invitationRedirect = url.toString();
    } catch {
      await adminClient
        .from("workspace_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitation.id);
      return json({ error: "The invitation redirect is invalid." }, 400);
    }

    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: invitationRedirect,
      data: { invitation_id: invitation.id },
    });
    if (inviteError) {
      await adminClient
        .from("workspace_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitation.id);
      return json({ error: inviteError.message }, 400);
    }
    return json({ ok: true });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not send invitation." },
      500,
    );
  }
});

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
