import { toast } from "@heroui/react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { TimerActionButton } from "@/components/timer-action-button";
import { TimerDurationEditor } from "@/components/timer-duration-editor";

export function HeaderTimerControl() {
  const { timer, elapsed, startTimer, pauseTimer, resumeTimer, setTimerElapsed } = useStore();
  const { t, error } = useI18n();

  const handleAction = () => {
    if (timer.status === "running") {
      pauseTimer();
      return;
    }

    if (timer.status === "paused") {
      resumeTimer();
      return;
    }

    const result = startTimer("Quick task", null);
    if (!result.success) {
      toast.danger(t("We couldn't start the timer"), { description: error(result.error) });
    }
  };

  return (
    <div className="flex items-center gap-2" data-header-timer-control data-status={timer.status}>
      <TimerDurationEditor
        elapsed={elapsed}
        isReadOnly={timer.status === "idle"}
        onElapsedChange={setTimerElapsed}
      />
      <TimerActionButton status={timer.status} onPress={handleAction} />
    </div>
  );
}
