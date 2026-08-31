export const reportViews = [
  { id: "overview", label: "Overview" },
  { id: "detailed", label: "Detailed" },
] as const;

export type ReportView = (typeof reportViews)[number]["id"];

export function normalizeReportView(value: unknown): ReportView {
  if (value === "weekly") return "overview";
  if (value === "team" || value === "summary") return "overview";
  return reportViews.some((view) => view.id === value) ? (value as ReportView) : "detailed";
}

export function isLegacyTeamReportView(value: unknown): boolean {
  return value === "team";
}
