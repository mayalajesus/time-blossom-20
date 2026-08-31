export const reportViews = [
  { id: "overview", label: "Overview" },
  { id: "summary", label: "Analysis" },
  { id: "detailed", label: "Detailed" },
] as const;

export type ReportView = (typeof reportViews)[number]["id"];

export function normalizeReportView(value: unknown): ReportView {
  if (value === "weekly") return "overview";
  if (value === "team") return "summary";
  return reportViews.some((view) => view.id === value) ? (value as ReportView) : "overview";
}

export function isLegacyTeamReportView(value: unknown): boolean {
  return value === "team";
}
