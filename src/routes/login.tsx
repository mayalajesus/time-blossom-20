import { Button, Form, Link } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AuthDivider,
  AuthError,
  AuthField,
  AuthFooter,
  AuthPage,
  GoogleAuthButton,
} from "@/components/auth-page";
import { signInWithGoogle, signInWithPassword } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { getAuthReturnPath } from "@/lib/auth-redirect";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { session } = useAuth();
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

  const continueWithGoogle = async () => {
    setError(null);
    setBusy(true);
    const result = await signInWithGoogle();
    if (!result.success) {
      setBusy(false);
      setError(result.error);
    }
  };

  return (
    <AuthPage title={t("Sign in")} description={t("Access your time tracking workspace.")}>
      <AuthError message={error} />
      <GoogleAuthButton onPress={continueWithGoogle} isDisabled={busy} />
      <AuthDivider />
      <Form className="space-y-4" onSubmit={submit}>
        <AuthField
          id="login-email"
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
          id="login-password"
          label={t("Password")}
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setError(null);
          }}
          autoComplete="current-password"
          placeholder={t("Enter your password")}
          validate={(value) => (value ? null : t("Password is required"))}
        />
        <div className="flex justify-end">
          <Link href="/forgot-password">{t("Forgot password?")}</Link>
        </div>
        <Button className="w-full" type="submit" isDisabled={busy}>
          {busy ? t("Signing in…") : t("Sign in")}
        </Button>
      </Form>
      <AuthFooter prompt={t("Don't have an account?")} to="/signup" action={t("Create account")} />
    </AuthPage>
  );
}
