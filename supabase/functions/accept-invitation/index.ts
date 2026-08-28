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
    const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
    if (!authorization || !invitationId) {
      return json({ error: "Invalid invitation details." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Your session is not valid." }, 401);

    const { data: workspaceId, error } = await userClient.rpc("accept_workspace_invitation", {
      invitation_id: invitationId,
    });
    if (error || !workspaceId)
      return json({ error: error?.message ?? "Could not accept invitation." }, 400);
    return json({ ok: true, workspaceId });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not accept invitation." },
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
