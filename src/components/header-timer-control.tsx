import { Button, toast } from "@heroui/react";
import { Pause, Play } from "lucide-react";
import { formatClock } from "@/lib/format";
import { useStore } from "@/lib/store";

export function HeaderTimerControl() {
  const { timer, elapsed, startTimer, pauseTimer, resumeTimer } = useStore();

  const isRunning = timer.status === "running";
  const actionLabel = isRunning ? "Pause" : timer.status === "paused" ? "Resume" : "Start";

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
      toast("Could not start timer", { description: result.error });
    }
  };

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1.5" data-header-timer-control>
      {timer.status !== "idle" ? (
        <span className="whitespace-nowrap font-mono text-sm tabular-nums text-muted">
          {formatClock(elapsed)}
        </span>
      ) : null}
      <Button
        aria-label={actionLabel}
        className="h-8 min-w-8 shrink-0 px-0 sm:h-9 sm:min-w-0 sm:px-3"
        size="sm"
        variant={isRunning ? "secondary" : "primary"}
        onPress={handleAction}
      >
        {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
        <span className="hidden sm:inline">{actionLabel}</span>
      </Button>
    </div>
  );
}
