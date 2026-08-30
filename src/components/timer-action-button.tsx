import { Button } from "@heroui/react";
import { Pause, Play } from "@gravity-ui/icons";
import type { TimerStatus } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

interface TimerActionButtonProps {
  status: TimerStatus;
  onPress: () => void;
}

export function TimerActionButton({ status, onPress }: TimerActionButtonProps) {
  const { t } = useI18n();
  const isRunning = status === "running";
  const actionLabel = isRunning ? t("Pause") : status === "paused" ? t("Resume") : t("Start");

  return (
    <Button
      aria-label={actionLabel}
      isIconOnly
      size="sm"
      variant={isRunning ? "secondary" : "primary"}
      className="shrink-0 rounded-lg"
      onPress={onPress}
    >
      {isRunning ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
    </Button>
  );
}
