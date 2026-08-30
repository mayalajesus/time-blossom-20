import { describe, expect, it } from "vitest";
import { elapsedForTimer, isValidTimeZone } from "../../src/lib/store";

describe("timer persistence domain", () => {
  it("computes running elapsed seconds without changing the stored timer", () => {
    const timer = {
      status: "running" as const,
      workspaceId: "w1",
      task: "Design",
      projectId: "p1",
      billable: true,
      startedAt: 1_000,
      startedDate: "2026-08-28",
      accumulated: 12,
      startClock: "09:00",
    };
    expect(elapsedForTimer(timer, 3_501)).toBe(14);
    expect(timer.accumulated).toBe(12);
  });

  it("accepts IANA zones and rejects invalid zones", () => {
    expect(isValidTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("not/a-timezone")).toBe(false);
  });
});
