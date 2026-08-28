import { Button, Card, Description, Label } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FormAlert } from "@/components/form-feedback";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export function AuthPage({
  title,
  description,
  children,
  notice,
}: {
  title: string;
  description: string;
  children: ReactNode;
  notice?: ReactNode;
}) {
  return (
    <main className="auth-page min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <section className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div
            className="profile-avatar-fallback mx-auto mb-4 size-12 rounded-2xl"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold tracking-wide text-accent">Time Blossom</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted">{description}</p>
        </div>
        <Card>
          <Card.Content className="space-y-5 p-5 sm:p-6">
            {notice}
            {children}
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required = true,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <input
        className="input input--full-width input--primary"
        id={id}
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  const { t, error } = useI18n();
  return message ? (
    <FormAlert title={t("Authentication failed")} description={error(message)} />
  ) : null;
}

export function AuthFooter({
  prompt,
  to,
  action,
}: {
  prompt: string;
  to: "/login" | "/signup" | "/forgot-password";
  action: string;
}) {
  return (
    <p className="text-center text-sm text-muted">
      {prompt}{" "}
      <Link className="font-medium text-link underline-offset-4 hover:underline" to={to}>
        {action}
      </Link>
    </p>
  );
}

export function LocalPreviewNotice() {
  const { configured } = useAuth();
  const { t } = useI18n();
  if (configured) return null;
  return <Description>{t("Authentication is not configured; use the local preview.")}</Description>;
}

export function ContinuePreviewButton() {
  const { t } = useI18n();
  return (
    <Button className="w-full" onPress={() => (window.location.href = "/tracker")}>
      {t("Continue to preview")}
    </Button>
  );
}
