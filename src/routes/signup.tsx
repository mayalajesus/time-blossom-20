import { Button } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AuthError,
  AuthField,
  AuthFooter,
  AuthPage,
  ContinueToWorkspaceButton,
} from "@/components/auth-page";
import { signUpWithPassword } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { getAuthReturnPath } from "@/lib/auth-redirect";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const { configured } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await signUpWithPassword(email.trim(), password);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setCreated(true);
  };

  return (
    <AuthPage
      title={t("Create your account")}
      description={t("Start a focused workspace for your team.")}
    >
      <AuthError message={error} />
      {created ? (
        <div className="space-y-4" role="status">
          <p className="text-sm text-foreground">
            {t("Check your email to confirm your account before signing in.")}
          </p>
          <Button
            className="w-full"
            onPress={() =>
              window.location.assign(`/login?redirect=${encodeURIComponent(getAuthReturnPath())}`)
            }
          >
            {t("Back to sign in")}
          </Button>
        </div>
      ) : configured ? (
        <form className="space-y-4" onSubmit={submit}>
          <AuthField
            id="signup-email"
            label={t("Email")}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <AuthField
            id="signup-password"
            label={t("Password")}
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <AuthField
            id="signup-confirmation"
            label={t("Confirm password")}
            type="password"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted">{t("Password must be at least 8 characters.")}</p>
          <Button className="w-full" type="submit" isDisabled={busy}>
            {busy ? t("Creating account…") : t("Create account")}
          </Button>
          <AuthFooter prompt={t("Already have an account?")} to="/login" action={t("Sign in")} />
        </form>
      ) : (
        <ContinueToWorkspaceButton />
      )}
    </AuthPage>
  );
}
