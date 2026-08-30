import type { TimerState } from "./store";

export const TIMER_REMINDER_DELAY_MS = 60 * 60 * 1000;

export type TimerReminderInput = {
  enabled: boolean;
  intervalMs: number;
  timer: Pick<TimerState, "status" | "startedAt" | "accumulated">;
};

export type TimerReminderClock = {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (timeout: unknown) => void;
  isVisible: () => boolean;
  onVisibilityChange: (callback: () => void) => () => void;
};

export type TimerReminderController = {
  update: (input: TimerReminderInput) => void;
  dispose: () => void;
};

export function runningElapsedMilliseconds(
  timer: Pick<TimerState, "status" | "startedAt" | "accumulated">,
  now: number,
): number {
  const accumulated = Math.max(0, timer.accumulated) * 1000;
  if (timer.status !== "running" || timer.startedAt === null) return accumulated;
  return accumulated + Math.max(0, now - timer.startedAt);
}

export function createTimerReminderController(
  clock: TimerReminderClock,
  onReminder: () => void,
): TimerReminderController {
  let input: TimerReminderInput | null = null;
  let nextThreshold = 0;
  let timeout: unknown = null;
  let unsubscribeVisibility: (() => void) | null = null;

  const clearScheduledWork = () => {
    if (timeout !== null) clock.clearTimeout(timeout);
    timeout = null;
    unsubscribeVisibility?.();
    unsubscribeVisibility = null;
  };

  const canSchedule = () =>
    Boolean(
      input?.enabled &&
      input.intervalMs > 0 &&
      input.timer.status === "running" &&
      input.timer.startedAt !== null,
    );

  const schedule = () => {
    if (!input || !canSchedule()) return;
    const elapsed = runningElapsedMilliseconds(input.timer, clock.now());
    const remaining = Math.max(0, nextThreshold - elapsed);
    timeout = clock.setTimeout(handleDue, remaining);
  };

  const advanceThreshold = (elapsed: number) => {
    if (!input) return;
    do {
      nextThreshold += input.intervalMs;
    } while (nextThreshold <= elapsed);
  };

  const remindIfDue = () => {
    if (!input || !canSchedule() || !clock.isVisible()) return false;
    const elapsed = runningElapsedMilliseconds(input.timer, clock.now());
    if (elapsed < nextThreshold) return false;
    onReminder();
    advanceThreshold(elapsed);
    return true;
  };

  function handleDue() {
    timeout = null;
    if (!input || !canSchedule()) return;
    remindIfDue();
    if (clock.isVisible()) schedule();
  }

  const handleVisibilityChange = () => {
    if (!clock.isVisible() || !input || !canSchedule()) return;
    if (timeout !== null) clock.clearTimeout(timeout);
    timeout = null;
    remindIfDue();
    schedule();
  };

  return {
    update(nextInput) {
      clearScheduledWork();
      input = nextInput;
      if (!canSchedule()) return;
      const elapsed = runningElapsedMilliseconds(nextInput.timer, clock.now());
      nextThreshold = (Math.floor(elapsed / nextInput.intervalMs) + 1) * nextInput.intervalMs;
      unsubscribeVisibility = clock.onVisibilityChange(handleVisibilityChange);
      schedule();
    },
    dispose() {
      clearScheduledWork();
      input = null;
    },
  };
}

export function createBrowserTimerReminderClock(): TimerReminderClock {
  return {
    now: () => Date.now(),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (timeout) => window.clearTimeout(timeout as number),
    isVisible: () => document.visibilityState === "visible",
    onVisibilityChange: (callback) => {
      document.addEventListener("visibilitychange", callback);
      return () => document.removeEventListener("visibilitychange", callback);
    },
  };
}
