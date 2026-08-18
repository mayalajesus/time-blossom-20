import { Alert } from "@heroui/react";
import type { ReactNode } from "react";

type FormAlertStatus = "accent" | "danger" | "default" | "success" | "warning";

export function FormAlert({
  title,
  description,
  status = "danger",
  children,
}: {
  title: string;
  description?: string;
  status?: FormAlertStatus;
  children?: ReactNode;
}) {
  return (
    <Alert status={status}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {description ? <Alert.Description>{description}</Alert.Description> : null}
        {children}
      </Alert.Content>
    </Alert>
  );
}
