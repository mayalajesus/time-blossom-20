import { Card } from "@heroui/react/card";
import { Typography } from "@heroui/react/typography";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <Typography type="h1" weight="semibold">
          {title}
        </Typography>
        {description ? (
          <Typography type="body-sm" color="muted">
            {description}
          </Typography>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <Typography type="body-xs" color="muted" weight="semibold">
        {label}
      </Typography>
      <Typography type="h3" weight="semibold" className="mt-2">
        {value}
      </Typography>
      {hint ? (
        <Typography type="body-xs" color="muted" className="mt-1">
          {hint}
        </Typography>
      ) : null}
    </Card>
  );
}
