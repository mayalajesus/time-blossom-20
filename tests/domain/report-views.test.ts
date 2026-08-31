import { describe, expect, it } from "vitest";
import { normalizeReportView, reportViews } from "../../src/lib/report-views";

describe("report views", () => {
  it("exposes only the two consolidated report pages", () => {
    expect(reportViews.map((view) => view.id)).toEqual(["overview", "detailed"]);
  });

  it("keeps legacy report links compatible", () => {
    expect(normalizeReportView("weekly")).toBe("overview");
    expect(normalizeReportView("team")).toBe("overview");
    expect(normalizeReportView("summary")).toBe("overview");
  });

  it("uses detailed for unknown views", () => {
    expect(normalizeReportView("unknown")).toBe("detailed");
  });
});
