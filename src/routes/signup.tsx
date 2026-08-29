import { Button, Form, Separator } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AuthError,
  AuthField,
  AuthFooter,
  AuthPage,
  GoogleAuthButton,
} from "@/components/auth-page";
import { signInWithGoogle, signUpWithPassword } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { getAuthReturnPath } from "@/lib/auth-redirect";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const { session } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) window.location.replace(getAuthReturnPath());
  }, [session]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number.");
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
          <p>{t("Check your email to confirm your account before signing in.")}</p>
          <Button
            className="w-full"
            onPress={() =>
              window.location.assign(`/login?redirect=${encodeURIComponent(getAuthReturnPath())}`)
            }
          >
            {t("Back to sign in")}
          </Button>
        </div>
      ) : (
        <>
          <Form className="space-y-4" onSubmit={submit}>
            <AuthField
              id="signup-email"
              label={t("Email")}
              type="email"
              value={email}
              onChange={(value) => {
                setEmail(value);
                setError(null);
              }}
              autoComplete="email"
              placeholder="john@example.com"
              validate={(value) => {
                if (!value.trim()) return t("Email is required");
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
                  ? null
                  : t("Enter a valid email address");
              }}
            />
            <AuthField
              id="signup-password"
              label={t("Password")}
              type="password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                setError(null);
              }}
              autoComplete="new-password"
              placeholder={t("Enter your password")}
              minLength={8}
              description={t("Use at least 8 characters, one uppercase letter and one number.")}
              validate={(value) => {
                if (value.length < 8) return t("Password must be at least 8 characters.");
                if (!/[A-Z]/.test(value))
                  return t("Password must contain at least one uppercase letter.");
                if (!/[0-9]/.test(value)) return t("Password must contain at least one number.");
                return null;
              }}
            />
            <AuthField
              id="signup-confirmation"
              label={t("Confirm password")}
              type="password"
              value={confirmation}
              onChange={(value) => {
                setConfirmation(value);
                setError(null);
              }}
              autoComplete="new-password"
              placeholder={t("Confirm your password")}
              validate={(value) => (value === password ? null : t("Passwords do not match."))}
            />
            <Button className="w-full" type="submit" isDisabled={busy}>
              {busy ? t("Creating account…") : t("Create account")}
            </Button>
          </Form>
          <div className="flex items-center gap-3" role="separator">
            <Separator className="flex-1" />
            {t("or")}
            <Separator className="flex-1" />
          </div>
          <GoogleAuthButton
            onPress={async () => {
              setError(null);
              setBusy(true);
              const result = await signInWithGoogle();
              setBusy(false);
              if (!result.success) setError(result.error);
            }}
            isDisabled={busy}
          />
          <AuthFooter prompt={t("Already have an account?")} to="/login" action={t("Sign in")} />
        </>
      )}
    </AuthPage>
  );
}
