import { toast } from "@heroui/react";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import {
  createBrowserTimerReminderClock,
  createTimerReminderController,
  TIMER_REMINDER_DELAY_MS,
} from "@/lib/timer-reminder";

export function TimerReminder() {
  const { timer, preferences } = useStore();
  const { t } = useI18n();

  useEffect(() => {
    const controller = createTimerReminderController(createBrowserTimerReminderClock(), () => {
      toast.info(t("Timer is still running"), {
        description: t("Keep working or stop it when you're done. Your timer will keep counting."),
      });
    });
    controller.update({
      enabled: preferences.reminders,
      intervalMs: TIMER_REMINDER_DELAY_MS,
      timer,
    });
    return () => controller.dispose();
  }, [preferences.reminders, t, timer]);

  return null;
}
