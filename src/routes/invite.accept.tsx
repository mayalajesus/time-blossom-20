import { Button } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AuthPage, ContinueToWorkspaceButton } from "@/components/auth-page";
import { FormAlert } from "@/components/form-feedback";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { createSupabaseDataSource } from "@/lib/supabase-data-source";

export const Route = createFileRoute("/invite/accept")({ component: InviteAcceptPage });

function InviteAcceptPage() {
  const { configured, session } = useAuth();
  const { t } = useI18n();
  const dataSource = useMemo(() => createSupabaseDataSource(), []);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const invitationId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const fromUrl = new URLSearchParams(window.location.search).get("invitation");
    const fromMetadata = session?.user.user_metadata?.["invitation_id"];
    return fromUrl ?? (typeof fromMetadata === "string" ? fromMetadata : "");
  }, [session]);

  const accept = async () => {
    if (!invitationId) {
      setErrorMessage("This invitation link is missing or invalid.");
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    const result = await dataSource.acceptInvitation(invitationId);
    setBusy(false);
    if (!result.success) {
      setErrorMessage(result.error);
      return;
    }
    setAccepted(true);
  };

  return (
    <AuthPage
      title={t("Workspace invitation")}
      description={t("Accept your invitation to collaborate on tracked time.")}
    >
      {!configured ? <ContinueToWorkspaceButton /> : null}
      {configured && errorMessage ? (
        <FormAlert title={t("Could not accept invitation")} description={t(errorMessage)} />
      ) : null}
      {configured && accepted ? (
        <div className="space-y-4" role="status">
          <p>{t("Your invitation has been accepted.")}</p>
          <Button className="w-full" onPress={() => window.location.assign("/tracker")}>
            {t("Open workspace")}
          </Button>
        </div>
      ) : configured && session ? (
        <div className="space-y-4">
          <p>{t("Your invitation is ready to be accepted.")}</p>
          <Button className="w-full" isDisabled={busy} onPress={() => void accept()}>
            {busy ? t("Accepting invitation…") : t("Accept invitation")}
          </Button>
        </div>
      ) : configured ? (
        <div className="space-y-4">
          <p>{t("Sign in or create your account to accept this invitation.")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="w-full"
              onPress={() => {
                window.location.assign(
                  `/login?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`,
                );
              }}
            >
              {t("Sign in")}
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onPress={() => {
                window.location.assign(
                  `/signup?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`,
                );
              }}
            >
              {t("Create account")}
            </Button>
          </div>
        </div>
      ) : null}
    </AuthPage>
  );
}
