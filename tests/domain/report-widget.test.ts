import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ReportChart,
  ReportKpi,
  ReportWidget,
  ReportWidgetGrid,
  limitReportChartCategories,
  reportChartAxisProps,
  reportChartCategoryLimits,
  reportChartTooltipProps,
  reportHorizontalBarProps,
  reportVerticalBarProps,
  shortenReportChartLabel,
} from "../../src/components/report-widget";

describe("report widget infrastructure", () => {
  it("renders an accessible HeroUI card region and its content", () => {
    const html = renderToStaticMarkup(
      createElement(ReportWidget, {
        title: "Tracked time",
        description: "Current period",
        contentDescription: "Two hours tracked in the current period.",
        children: createElement("span", null, "2h"),
      }),
    );

    expect(html).toContain('role="region"');
    expect(html).toContain("Two hours tracked in the current period.");
    expect(html).toContain("Current period");
    expect(html).toContain("2h");
  });

  it("prioritizes loading, error and empty states over widget content", () => {
    const loading = renderToStaticMarkup(
      createElement(ReportWidget, {
        title: "Tracked time",
        contentDescription: "Tracked time widget",
        loading: true,
        loadingLabel: "Loading metrics",
        children: "Hidden content",
      }),
    );
    const error = renderToStaticMarkup(
      createElement(ReportWidget, {
        title: "Tracked time",
        contentDescription: "Tracked time widget",
        error: { title: "Unable to load", description: "Try again" },
        children: "Hidden content",
      }),
    );
    const empty = renderToStaticMarkup(
      createElement(ReportWidget, {
        title: "Tracked time",
        contentDescription: "Tracked time widget",
        isEmpty: true,
        emptyState: { title: "No activity", description: "Choose another period" },
        children: "Hidden content",
      }),
    );

    expect(loading).toContain("Loading metrics");
    expect(loading).not.toContain("Hidden content");
    expect(error).toContain("Unable to load");
    expect(error).not.toContain("Hidden content");
    expect(empty).toContain("No activity");
    expect(empty).not.toContain("Hidden content");
  });

  it("uses one, two and three responsive grid columns", () => {
    const html = renderToStaticMarkup(
      createElement(ReportWidgetGrid, { children: createElement("span", null, "Widget") }),
    );

    expect(html).toContain("grid-cols-1");
    expect(html).toContain("md:grid-cols-2");
    expect(html).toContain("lg:grid-cols-3");
  });

  it("renders a neutral KPI state when no comparison exists", () => {
    const html = renderToStaticMarkup(
      createElement(ReportKpi, {
        title: "Tracked time",
        value: "8h 30m",
        secondaryInformation: "5 active days",
        contentDescription: "Eight hours and thirty minutes tracked across five active days.",
      }),
    );

    expect(html).toContain("8h 30m");
    expect(html).toContain("5 active days");
    expect(html).toContain("No comparison");
  });

  it("does not render an empty chart container or empty axes", () => {
    const html = renderToStaticMarkup(
      createElement(ReportChart, {
        config: {},
        summary: "There is no activity in this period.",
        isEmpty: true,
        children: createElement("div"),
      }),
    );

    expect(html).toContain("No chart data");
    expect(html).not.toContain("data-chart");
    expect(html).not.toContain("recharts");
  });
});

describe("report chart standards", () => {
  it("defines bar, tooltip and axis defaults without animation", () => {
    expect(reportVerticalBarProps).toMatchObject({
      barSize: 8,
      radius: [4, 4, 0, 0],
      isAnimationActive: false,
      activeBar: false,
    });
    expect(reportHorizontalBarProps).toMatchObject({
      barSize: 10,
      radius: [0, 4, 4, 0],
      isAnimationActive: false,
      activeBar: false,
    });
    expect(reportChartTooltipProps.cursor).toBe(false);
    expect(reportChartAxisProps).toEqual({ axisLine: false, tickLine: false });
  });

  it("limits visible categories and shortens long labels", () => {
    const categories = Array.from({ length: 10 }, (_, index) => index);

    expect(reportChartCategoryLimits).toEqual({ compact: 6, default: 8 });
    expect(limitReportChartCategories(categories)).toEqual(categories.slice(0, 8));
    expect(limitReportChartCategories(categories, 6)).toEqual(categories.slice(0, 6));
    expect(shortenReportChartLabel("A very long category", 10)).toBe("A very lo…");
  });
});
