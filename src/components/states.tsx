import { Alert, Button, Card, Skeleton } from "@heroui/react";
import type { ReactNode } from "react";

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <Card.Content className="flex flex-col gap-3 py-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 flex-1 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <Card.Content className="flex flex-col gap-3 py-5">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="h-2 w-full rounded-md" />
          </Card.Content>
        </Card>
      ))}
    </div>
  );
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
    <Card variant="secondary">
      <Card.Content className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted">
          {icon}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="max-w-sm text-sm text-muted">{description}</p>
        </div>
        {action}
      </Card.Content>
    </Card>
  );
}

export function ErrorBlock({
  title = "Something went wrong",
  description = "We couldn't load this data. Check your connection and try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>{description}</Alert.Description>
        {onRetry ? (
          <Button className="mt-3" size="sm" variant="secondary" onPress={onRetry}>
            Try again
          </Button>
        ) : null}
      </Alert.Content>
    </Alert>
  );
}
