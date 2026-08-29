import { Button, Form, Typography } from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthError, AuthField, AuthFooter, AuthPage } from "@/components/auth-page";
import { requestPasswordReset } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await requestPasswordReset(email.trim());
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  return (
    <AuthPage
      title={t("Reset your password")}
      description={t("We will send a secure reset link to your email.")}
    >
      <AuthError message={error} />
      {sent ? (
        <div className="space-y-4" role="status">
          <Typography type="body-sm" color="muted">
            {t("If an account exists for this email, a reset link is on its way.")}
          </Typography>
          <Button className="w-full" onPress={() => navigate({ to: "/login" })}>
            {t("Back to sign in")}
          </Button>
        </div>
      ) : (
        <Form className="space-y-4" onSubmit={submit}>
          <AuthField
            id="reset-email"
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
          <Button className="w-full" type="submit" isDisabled={busy}>
            {busy ? t("Sending…") : t("Send reset link")}
          </Button>
          <AuthFooter prompt={t("Remember your password?")} to="/login" action={t("Sign in")} />
        </Form>
      )}
    </AuthPage>
  );
}
