import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTimerReminderController,
  runningElapsedMilliseconds,
  type TimerReminderClock,
} from "../../src/lib/timer-reminder";

function fakeClock() {
  let visible = true;
  const visibilityListeners = new Set<() => void>();
  const clock: TimerReminderClock = {
    now: () => Date.now(),
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (timeout) => clearTimeout(timeout as ReturnType<typeof setTimeout>),
    isVisible: () => visible,
    onVisibilityChange: (callback) => {
      visibilityListeners.add(callback);
      return () => visibilityListeners.delete(callback);
    },
  };
  return {
    clock,
    setVisible(nextVisible: boolean) {
      visible = nextVisible;
      for (const listener of visibilityListeners) listener();
    },
  };
}

const runningTimer = {
  status: "running" as const,
  startedAt: 0,
  accumulated: 0,
};

describe("active timer reminders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for the configured period and disabling it cancels future reminders", () => {
    const reminder = vi.fn();
    const { clock } = fakeClock();
    const controller = createTimerReminderController(clock, reminder);
    controller.update({ enabled: true, intervalMs: 60_000, timer: runningTimer });

    vi.advanceTimersByTime(59_999);
    expect(reminder).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(reminder).toHaveBeenCalledTimes(1);

    controller.update({ enabled: false, intervalMs: 60_000, timer: runningTimer });
    vi.advanceTimersByTime(180_000);
    expect(reminder).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("delivers a due reminder after returning from a background tab", () => {
    const reminder = vi.fn();
    const visibility = fakeClock();
    const controller = createTimerReminderController(visibility.clock, reminder);
    controller.update({ enabled: true, intervalMs: 60_000, timer: runningTimer });

    visibility.setVisible(false);
    vi.advanceTimersByTime(60_000);
    expect(reminder).not.toHaveBeenCalled();

    visibility.setVisible(true);
    expect(reminder).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("keeps the reminder schedule after a reload without changing the counter", () => {
    const reminder = vi.fn();
    const firstClock = fakeClock();
    const firstController = createTimerReminderController(firstClock.clock, reminder);
    firstController.update({ enabled: true, intervalMs: 60_000, timer: runningTimer });

    vi.advanceTimersByTime(60_000);
    expect(reminder).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    firstController.dispose();

    const reloadedClock = fakeClock();
    const reloadedController = createTimerReminderController(reloadedClock.clock, reminder);
    reloadedController.update({ enabled: true, intervalMs: 60_000, timer: runningTimer });

    vi.advanceTimersByTime(49_999);
    expect(reminder).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(reminder).toHaveBeenCalledTimes(2);
    expect(runningElapsedMilliseconds(runningTimer, Date.now())).toBe(120_000);
    expect(runningTimer).toEqual({ status: "running", startedAt: 0, accumulated: 0 });
    reloadedController.dispose();
  });
});
