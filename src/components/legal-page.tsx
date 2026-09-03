import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Typography } from "@heroui/react/typography";
import type { ReactNode } from "react";
import { RouterLink } from "./router-link";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <article className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Typography type="h1" weight="semibold">
              {title}
            </Typography>
            <Typography type="body-sm" color="muted" className="mt-1">
              Última atualização: {updated}
            </Typography>
          </div>
          <Button variant="secondary" onPress={() => window.history.back()}>
            Voltar
          </Button>
        </div>
        <Card className="space-y-6 p-5 sm:p-7">{children}</Card>
        <Typography type="body-xs" color="muted" align="center">
          <RouterLink to="/terms">Termos de Uso</RouterLink>
          {" · "}
          <RouterLink to="/privacy">Aviso de Privacidade</RouterLink>
          {" · "}
          <RouterLink to="/login">Entrar</RouterLink>
        </Typography>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <Typography type="h2" weight="semibold">
        {title}
      </Typography>
      <div className="space-y-2 text-sm leading-6 text-muted">{children}</div>
    </section>
  );
}
