import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createIdleDetectionController,
  DEFAULT_IDLE_TIMEOUT_MS,
  type IdleDetectionClock,
} from "../../src/lib/idle-detection";
import { pauseTimerAt, type TimerState } from "../../src/lib/store";

function fakeClock() {
  let visible = true;
  const activityListeners = new Set<() => void>();
  const visibilityListeners = new Set<() => void>();
  const clock: IdleDetectionClock = {
    now: () => Date.now(),
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (timeout) => clearTimeout(timeout as ReturnType<typeof setTimeout>),
    isVisible: () => visible,
    onActivity: (callback) => {
      activityListeners.add(callback);
      return () => activityListeners.delete(callback);
    },
    onVisibilityChange: (callback) => {
      visibilityListeners.add(callback);
      return () => visibilityListeners.delete(callback);
    },
  };

  return {
    clock,
    activity() {
      for (const listener of activityListeners) listener();
    },
    setVisible(nextVisible: boolean) {
      visible = nextVisible;
      for (const listener of visibilityListeners) listener();
    },
  };
}

const runningInput = {
  enabled: true,
  timeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  status: "running" as const,
  startedAt: 0,
};

describe("idle detection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks once when a running timer reaches the inactivity limit", () => {
    const prompt = vi.fn();
    const { clock } = fakeClock();
    const controller = createIdleDetectionController(clock, prompt, vi.fn());
    controller.update(runningInput);

    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS - 1);
    expect(prompt).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenLastCalledWith(0);

    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS * 2);
    expect(prompt).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("does nothing while the timer is paused, stopped, or idle detection is disabled", () => {
    const prompt = vi.fn();
    const visibility = fakeClock();
    const controller = createIdleDetectionController(visibility.clock, prompt, vi.fn());
    controller.update({ ...runningInput, status: "paused", startedAt: null });

    visibility.activity();
    visibility.setVisible(false);
    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS * 2);
    visibility.setVisible(true);

    controller.update({ ...runningInput, status: "idle", startedAt: null });
    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);
    controller.update({ ...runningInput, enabled: false });
    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);

    expect(prompt).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    controller.dispose();
  });

  it("pauses at the last activity and excludes the full idle period", () => {
    const visibility = fakeClock();
    const timer: TimerState = {
      status: "running",
      workspaceId: "w1",
      task: "Design",
      projectId: "p1",
      billable: true,
      startedAt: 0,
      startedDate: "2026-08-30",
      accumulated: 30,
      startClock: "09:00",
    };
    let pausedTimer = timer;
    const onPause = vi.fn((effectiveAt: number) => {
      pausedTimer = pauseTimerAt(timer, effectiveAt);
    });
    const controller = createIdleDetectionController(visibility.clock, vi.fn(), onPause);
    controller.update(runningInput);

    vi.advanceTimersByTime(120_000);
    visibility.activity();
    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS + 60_000);
    controller.pause();

    expect(onPause).toHaveBeenCalledWith(120_000);
    expect(pausedTimer.status).toBe("paused");
    expect(pausedTimer.startedAt).toBeNull();
    expect(pausedTimer.accumulated).toBe(150);
    controller.dispose();
  });

  it("keeps running and starts a fresh cycle when the user continues working", () => {
    const prompt = vi.fn();
    const onPause = vi.fn();
    const { clock } = fakeClock();
    const controller = createIdleDetectionController(clock, prompt, onPause);
    controller.update(runningInput);

    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);
    controller.continueWorking();
    expect(prompt).toHaveBeenLastCalledWith(null);
    expect(onPause).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS - 1);
    expect(prompt).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(prompt).toHaveBeenCalledTimes(3);
    expect(prompt).toHaveBeenLastCalledWith(DEFAULT_IDLE_TIMEOUT_MS);
    controller.dispose();
  });

  it("resets the deadline when the user interacts before the limit", () => {
    const prompt = vi.fn();
    const visibility = fakeClock();
    const controller = createIdleDetectionController(visibility.clock, prompt, vi.fn());
    controller.update(runningInput);

    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS - 60_000);
    visibility.activity();
    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS - 1);
    expect(prompt).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(prompt).toHaveBeenCalledWith(DEFAULT_IDLE_TIMEOUT_MS - 60_000);
    controller.dispose();
  });

  it("checks elapsed inactivity when a background tab becomes visible", () => {
    const prompt = vi.fn();
    const visibility = fakeClock();
    const controller = createIdleDetectionController(visibility.clock, prompt, vi.fn());
    controller.update(runningInput);

    vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS - 60_000);
    visibility.setVisible(false);
    vi.advanceTimersByTime(120_000);
    expect(prompt).not.toHaveBeenCalled();

    visibility.setVisible(true);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledWith(0);
    controller.dispose();
  });
});
