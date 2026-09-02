import { Button } from "@heroui/react/button";
import { Spinner } from "@heroui/react/spinner";
import { Typography } from "@heroui/react/typography";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthError, AuthPage } from "@/components/auth-page";
import { useAuth } from "@/lib/auth-context";
import { getAuthReturnPath } from "@/lib/auth-redirect";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallbackPage });

function AuthCallbackPage() {
  const { session, loading } = useAuth();
  const { t } = useI18n();
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const callbackError = search.get("error_description") ?? hash.get("error_description");

  useEffect(() => {
    if (!loading && session) window.location.replace(getAuthReturnPath());
  }, [loading, session]);

  if (!loading && !session) {
    return (
      <AuthPage
        title={t("Authentication failed")}
        description={t("Preparing your workspace securely.")}
      >
        <AuthError message={callbackError ?? "Authentication failed"} />
        <Button className="w-full" onPress={() => window.location.replace("/login")}>
          {t("Back to sign in")}
        </Button>
      </AuthPage>
    );
  }

  return (
    <AuthPage title={t("Finishing sign in")} description={t("Preparing your workspace securely.")}>
      <div
        className="flex flex-col items-center gap-3 py-6 text-center"
        role="status"
        aria-live="polite"
      >
        <Spinner aria-label={t("Loading data")} />
        <Typography type="body-sm" color="muted">
          {t("Finishing sign in")}
        </Typography>
      </div>
    </AuthPage>
  );
}
