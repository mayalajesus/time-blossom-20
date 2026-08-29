import { Alert, Button, Card, Spinner, Typography } from "@heroui/react";
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
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center">{icon}</div>
      <div className="space-y-1">
        <Typography type="body-sm" weight="semibold">
          {title}
        </Typography>
        <Typography type="body-sm" color="muted" className="max-w-sm">
          {description}
        </Typography>
      </div>
      {action}
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
        <Alert.Title>{title ?? t("Something went wrong")}</Alert.Title>
        <Alert.Description>
          {description ?? t("We couldn't load this data. Check your connection and try again.")}
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
