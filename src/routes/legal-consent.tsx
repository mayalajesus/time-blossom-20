import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Checkbox } from "@heroui/react/checkbox";
import { Typography } from "@heroui/react/typography";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { RouterLink } from "@/components/router-link";
import { useAccountLifecycle } from "@/lib/account-lifecycle-context";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/legal-consent")({ component: LegalConsentPage });

function LegalConsentPage() {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { acceptLegalTerms, status } = useAccountLifecycle();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!accepted) return;
    setBusy(true);
    const result = await acceptLegalTerms(locale);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    void navigate({ to: "/tracker", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg space-y-5 p-6">
        <div className="space-y-2">
          <Typography type="h1" weight="semibold">
            Antes de continuar
          </Typography>
          <Typography type="body-sm" color="muted">
            Leia e aceite os documentos vigentes para usar a beta pública no Brasil.
          </Typography>
        </div>
        {error ? (
          <FormAlert title="Não foi possível registrar o aceite" description={error} />
        ) : null}
        <Checkbox isSelected={accepted} onChange={setAccepted}>
          Li e aceito os <RouterLink to="/terms">Termos de Uso</RouterLink> (versão{" "}
          {status?.legal.termsVersion}) e o{" "}
          <RouterLink to="/privacy">Aviso de Privacidade</RouterLink> (versão{" "}
          {status?.legal.privacyVersion}).
        </Checkbox>
        <Button isDisabled={!accepted} isPending={busy} onPress={() => void submit()}>
          Aceitar e continuar
        </Button>
      </Card>
    </main>
  );
}
