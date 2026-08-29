import { Button } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AuthError,
  AuthField,
  AuthFooter,
  AuthPage,
  ContinueToWorkspaceButton,
} from "@/components/auth-page";
import { signInWithGoogle, signInWithPassword } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { getAuthReturnPath } from "@/lib/auth-redirect";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { configured, session } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) window.location.replace(getAuthReturnPath());
  }, [session]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    window.location.replace(getAuthReturnPath());
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    const result = await signInWithGoogle();
    setBusy(false);
    if (!result.success) setError(result.error);
  };

  return (
    <AuthPage title={t("Sign in")} description={t("Access your time tracking workspace.")}>
      <AuthError message={error} />
      {configured ? (
        <>
          <form className="space-y-4" onSubmit={submit}>
            <AuthField
              id="login-email"
              label={t("Email")}
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <AuthField
              id="login-password"
              label={t("Password")}
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <div className="flex justify-end">
              <a
                className="text-sm text-link underline-offset-4 hover:underline"
                href="/forgot-password"
              >
                {t("Forgot password?")}
              </a>
            </div>
            <Button className="w-full" type="submit" isDisabled={busy}>
              {busy ? t("Signing in…") : t("Sign in")}
            </Button>
          </form>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-separator" />
            {t("or")}
            <span className="h-px flex-1 bg-separator" />
          </div>
          <Button
            className="w-full"
            variant="secondary"
            type="button"
            isDisabled={busy}
            onPress={google}
          >
            {t("Continue with Google")}
          </Button>
          <AuthFooter
            prompt={t("Don't have an account?")}
            to="/signup"
            action={t("Create account")}
          />
        </>
      ) : (
        <ContinueToWorkspaceButton />
      )}
    </AuthPage>
  );
}
