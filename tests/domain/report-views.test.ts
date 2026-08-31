import { describe, expect, it } from "vitest";
import { normalizeReportView, reportViews } from "../../src/lib/report-views";

describe("report views", () => {
  it("exposes only the three consolidated report pages", () => {
    expect(reportViews.map((view) => view.id)).toEqual(["overview", "summary", "detailed"]);
  });

  it("keeps legacy report links compatible", () => {
    expect(normalizeReportView("weekly")).toBe("overview");
    expect(normalizeReportView("team")).toBe("summary");
  });

  it("uses overview for unknown views", () => {
    expect(normalizeReportView("unknown")).toBe("overview");
  });
});
