import { Button, toast } from "@heroui/react";
import { Pause, Play } from "lucide-react";
import { formatClock } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";

export function HeaderTimerControl() {
  const { timer, elapsed, startTimer, pauseTimer, resumeTimer } = useStore();
  const { t, error } = useI18n();

  const isRunning = timer.status === "running";
  const actionLabel = isRunning ? t("Pause") : timer.status === "paused" ? t("Resume") : t("Start");

  const handleAction = () => {
    if (isRunning) {
      pauseTimer();
      return;
    }

    if (timer.status === "paused") {
      resumeTimer();
      return;
    }

    const result = startTimer("Quick task", null);
    if (!result.success) {
      toast(t("Could not start timer"), { description: error(result.error) });
    }
  };

  return (
    <div className="flex items-center gap-2" data-header-timer-control data-status={timer.status}>
      <span
        aria-atomic="true"
        aria-live="polite"
        aria-label={`${t("Timer")}: ${formatClock(elapsed)}`}
      >
        {formatClock(elapsed)}
      </span>
      <Button
        aria-label={actionLabel}
        isIconOnly
        size="sm"
        variant={isRunning ? "secondary" : "primary"}
        onPress={handleAction}
      >
        {isRunning ? (
          <Pause aria-hidden="true" className="size-4" />
        ) : (
          <Play aria-hidden="true" className="size-4" />
        )}
      </Button>
    </div>
  );
}
