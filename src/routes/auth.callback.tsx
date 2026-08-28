import { Spinner } from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthPage } from "@/components/auth-page";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallbackPage });

function AuthCallbackPage() {
  const { session, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/tracker", replace: true });
  }, [loading, navigate, session]);

  return (
    <AuthPage title={t("Finishing sign in")} description={t("Preparing your workspace securely.")}>
      <div
        className="flex flex-col items-center gap-3 py-6 text-center"
        role="status"
        aria-live="polite"
      >
        <Spinner aria-label={t("Loading data")} className="motion-reduce:animate-none" />
        <p className="text-sm text-muted">{t("Finishing sign in")}</p>
      </div>
    </AuthPage>
  );
}
