import type { TimerStatus } from "./store";

export const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export type IdleDetectionInput = {
  enabled: boolean;
  timeoutMs: number;
  status: TimerStatus;
  startedAt: number | null;
};

export type IdleDetectionClock = {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (timeout: unknown) => void;
  isVisible: () => boolean;
  onActivity: (callback: () => void) => () => void;
  onVisibilityChange: (callback: () => void) => () => void;
};

export type IdleDetectionController = {
  update: (input: IdleDetectionInput) => void;
  pause: () => void;
  continueWorking: () => void;
  dispose: () => void;
};

export function createIdleDetectionController(
  clock: IdleDetectionClock,
  onPromptChange: (idleStartedAt: number | null) => void,
  onPause: (idleStartedAt: number) => void,
): IdleDetectionController {
  let input: IdleDetectionInput | null = null;
  let lastActivityAt = clock.now();
  let promptedIdleStartedAt: number | null = null;
  let timeout: unknown = null;
  let unsubscribeActivity: (() => void) | null = null;
  let unsubscribeVisibility: (() => void) | null = null;

  const isWatching = () =>
    Boolean(input?.enabled && input.timeoutMs > 0 && input.status === "running");

  const clearScheduledCheck = () => {
    if (timeout !== null) clock.clearTimeout(timeout);
    timeout = null;
  };

  const schedule = () => {
    clearScheduledCheck();
    if (!input || !isWatching() || promptedIdleStartedAt !== null || !clock.isVisible()) return;
    const remaining = Math.max(0, input.timeoutMs - (clock.now() - lastActivityAt));
    timeout = clock.setTimeout(handleDue, remaining);
  };

  const promptIfDue = () => {
    if (!input || !isWatching() || promptedIdleStartedAt !== null || !clock.isVisible())
      return false;
    if (clock.now() - lastActivityAt < input.timeoutMs) return false;
    promptedIdleStartedAt = lastActivityAt;
    onPromptChange(lastActivityAt);
    return true;
  };

  function handleDue() {
    timeout = null;
    if (!promptIfDue()) schedule();
  }

  const handleActivity = () => {
    if (!isWatching() || promptedIdleStartedAt !== null) return;
    lastActivityAt = clock.now();
  };

  const handleVisibilityChange = () => {
    if (!isWatching()) return;
    if (!clock.isVisible()) {
      clearScheduledCheck();
      return;
    }
    if (!promptIfDue()) schedule();
  };

  const startWatching = () => {
    lastActivityAt = clock.now();
    unsubscribeActivity = clock.onActivity(handleActivity);
    unsubscribeVisibility = clock.onVisibilityChange(handleVisibilityChange);
    schedule();
  };

  const stopWatching = (notify = true) => {
    clearScheduledCheck();
    unsubscribeActivity?.();
    unsubscribeActivity = null;
    unsubscribeVisibility?.();
    unsubscribeVisibility = null;
    if (notify && promptedIdleStartedAt !== null) onPromptChange(null);
    promptedIdleStartedAt = null;
  };

  return {
    update(nextInput) {
      const wasWatching = isWatching();
      const previousStartedAt = input?.startedAt ?? null;
      input = nextInput;
      const shouldWatch = isWatching();

      if (!shouldWatch) {
        stopWatching();
        return;
      }

      if (!wasWatching) {
        startWatching();
        return;
      }

      if (previousStartedAt !== nextInput.startedAt && promptedIdleStartedAt === null) {
        lastActivityAt = clock.now();
      }
      schedule();
    },
    pause() {
      if (promptedIdleStartedAt === null) return;
      const idleStartedAt = promptedIdleStartedAt;
      stopWatching();
      input = input ? { ...input, status: "paused" } : null;
      onPause(idleStartedAt);
    },
    continueWorking() {
      if (!isWatching()) return;
      promptedIdleStartedAt = null;
      lastActivityAt = clock.now();
      onPromptChange(null);
      schedule();
    },
    dispose() {
      stopWatching(false);
      input = null;
    },
  };
}

export function createBrowserIdleDetectionClock(): IdleDetectionClock {
  const activityEvents = [
    "keydown",
    "mousemove",
    "mousedown",
    "pointerdown",
    "touchstart",
    "wheel",
    "scroll",
    "click",
    "input",
  ] as const;
  const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };

  return {
    now: () => Date.now(),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (timeout) => window.clearTimeout(timeout as number),
    isVisible: () => document.visibilityState === "visible",
    onActivity: (callback) => {
      for (const event of activityEvents) window.addEventListener(event, callback, listenerOptions);
      return () => {
        for (const event of activityEvents)
          window.removeEventListener(event, callback, listenerOptions);
      };
    },
    onVisibilityChange: (callback) => {
      document.addEventListener("visibilitychange", callback);
      return () => document.removeEventListener("visibilitychange", callback);
    },
  };
}
