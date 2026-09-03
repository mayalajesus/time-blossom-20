import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Typography } from "@heroui/react/typography";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { useAccountLifecycle } from "@/lib/account-lifecycle-context";

export const Route = createFileRoute("/account-deletion")({ component: AccountDeletionPage });

function AccountDeletionPage() {
  const navigate = useNavigate();
  const { status, cancelDeletion } = useAccountLifecycle();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const executeAfter = status?.deletion?.executeAfter
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
        new Date(status.deletion.executeAfter),
      )
    : null;

  const cancel = async () => {
    setBusy(true);
    const result = await cancelDeletion();
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    void navigate({ to: "/tracker", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg space-y-5 p-6 text-center">
        <div className="space-y-2">
          <Typography type="h1" weight="semibold">
            Conta agendada para exclusão
          </Typography>
          <Typography type="body-sm" color="muted">
            {executeAfter
              ? `A exclusão definitiva está prevista para ${executeAfter}. Até lá, somente o cancelamento está disponível.`
              : "Sua conta está na janela de cancelamento da exclusão."}
          </Typography>
        </div>
        {error ? (
          <FormAlert title="Não foi possível cancelar a exclusão" description={error} />
        ) : null}
        <Button isPending={busy} onPress={() => void cancel()}>
          Cancelar exclusão e restaurar acesso
        </Button>
      </Card>
    </main>
  );
}
