import { Alert } from "@heroui/react/alert";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Spinner } from "@heroui/react/spinner";
import { Typography } from "@heroui/react/typography";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

export function LoadingState({ label, className }: { label?: string; className?: string }) {
  const { t } = useI18n();
  const loadingLabel = label ?? t("Loading data");

  return (
    <Card
      variant="secondary"
      {...(className ? { className } : {})}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      <div className="flex min-h-24 flex-col items-center justify-center gap-3 px-4 py-6 text-center">
        <Spinner aria-hidden="true" />
        <Typography type="body-sm" color="muted">
          {loadingLabel}
        </Typography>
      </div>
    </Card>
  );
}

export function TableSkeleton({ rows: _rows = 5 }: { rows?: number }) {
  return <LoadingState />;
}

export function CardsSkeleton({ count: _count = 4 }: { count?: number }) {
  return <LoadingState />;
}

export function EmptyBlock({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex min-h-56 w-full flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex size-11 shrink-0 items-center justify-center">{icon}</div>
      <div className="flex w-full max-w-sm flex-col items-center gap-1 text-center">
        <Typography type="body-sm" weight="semibold">
          {title}
        </Typography>
        <Typography type="body-sm" color="muted" className="w-full text-center">
          {description}
        </Typography>
      </div>
      {action ? <div className="flex w-full justify-center">{action}</div> : null}
    </Card>
  );
}

export function ErrorBlock({
  title,
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title ?? t("This section couldn't load")}</Alert.Title>
        <Alert.Description>
          {description ?? t("Try again, or check your connection if the problem continues.")}
        </Alert.Description>
        {onRetry ? (
          <Button className="mt-3" size="sm" variant="secondary" onPress={onRetry}>
            {t("Try again")}
          </Button>
        ) : null}
      </Alert.Content>
    </Alert>
  );
}
