import { Alert, CloseButton } from "@heroui/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type FormAlertStatus = "accent" | "danger" | "default" | "success" | "warning";

export function FormAlert({
  title,
  description,
  status = "danger",
  children,
  duration = 6000,
}: {
  title: string;
  description?: string;
  status?: FormAlertStatus;
  children?: ReactNode;
  duration?: number;
}) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const timeout = window.setTimeout(() => setIsVisible(false), duration);

    return () => window.clearTimeout(timeout);
  }, [description, duration, status, title]);

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <Alert role="alert" status={status} className="pointer-events-auto w-full max-w-xl">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{title}</Alert.Title>
          {description ? <Alert.Description>{description}</Alert.Description> : null}
          {children}
        </Alert.Content>
        <CloseButton aria-label={t("Close")} onPress={() => setIsVisible(false)} />
      </Alert>
    </div>
  );
}
