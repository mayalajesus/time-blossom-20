import type { BillingPreference, MoneyTotals } from "./billing";
import { sumBillableValues } from "./billing";
import type { Client, Member, Project, TimeEntry } from "./domain";
import { formatDate, normalizeSearch } from "./format";
import type { Locale } from "./i18n";

export type GroupDimension = "project" | "client" | "member" | "task" | "date";

export const reportGroupOptions: Array<{ id: GroupDimension; label: string }> = [
  { id: "project", label: "Project" },
  { id: "client", label: "Client" },
  { id: "member", label: "Member" },
  { id: "task", label: "Task" },
  { id: "date", label: "Date" },
];

export type ReportGroup = {
  key: string;
  label: string;
  seconds: number;
  billable: number;
  records: number;
  entries: TimeEntry[];
  billableValue: MoneyTotals;
  children?: ReportGroup[];
};

export function nameForMember(members: Member[], id: string): string {
  return members.find((member) => member.id === id)?.name ?? "Unknown member";
}

export function projectFor(projects: Project[], id: string | null): Project | null {
  return id ? (projects.find((project) => project.id === id) ?? null) : null;
}

export function clientNameFor(
  clients: Client[],
  projects: Project[],
  projectId: string | null,
): string {
  const project = projectFor(projects, projectId);
  return project
    ? (clients.find((client) => client.id === project.clientId)?.name ?? "Unknown client")
    : "No client";
}

export function projectNameFor(projects: Project[], projectId: string | null): string {
  return projectFor(projects, projectId)?.name ?? "No project";
}

function dimensionLabel(
  entry: TimeEntry,
  dimension: GroupDimension,
  members: Member[],
  projects: Project[],
  clients: Client[],
  locale: Locale,
): string {
  if (dimension === "project") return projectNameFor(projects, entry.projectId);
  if (dimension === "client") return clientNameFor(clients, projects, entry.projectId);
  if (dimension === "member") return nameForMember(members, entry.userId);
  if (dimension === "task") return entry.task || "Untitled task";
  return formatDate(entry.date, locale);
}

function dimensionKey(entry: TimeEntry, dimension: GroupDimension, projects: Project[]): string {
  if (dimension === "project") return entry.projectId ?? "none";
  if (dimension === "client") return projectFor(projects, entry.projectId)?.clientId ?? "none";
  if (dimension === "member") return entry.userId;
  if (dimension === "task") return normalizeSearch(entry.task);
  return entry.date;
}

export function buildReportGroups(
  entries: TimeEntry[],
  primary: GroupDimension,
  secondary: GroupDimension | "none",
  members: Member[],
  projects: Project[],
  clients: Client[],
  locale: Locale,
  fallbackForEntry: (entry: TimeEntry) => BillingPreference,
): ReportGroup[] {
  const primaryMap = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = dimensionKey(entry, primary, projects);
    const current = primaryMap.get(key) ?? [];
    current.push(entry);
    primaryMap.set(key, current);
  }

  return [...primaryMap.entries()]
    .map(([key, groupEntries]) => {
      const children =
        secondary === "none" || secondary === primary
          ? undefined
          : buildReportGroups(
              groupEntries,
              secondary,
              "none",
              members,
              projects,
              clients,
              locale,
              fallbackForEntry,
            );
      return {
        key,
        label: dimensionLabel(
          groupEntries[0] ?? entries[0]!,
          primary,
          members,
          projects,
          clients,
          locale,
        ),
        seconds: groupEntries.reduce((sum, entry) => sum + entry.seconds, 0),
        billable: groupEntries
          .filter((entry) => entry.billable)
          .reduce((sum, entry) => sum + entry.seconds, 0),
        records: groupEntries.length,
        entries: groupEntries,
        billableValue: sumBillableValues(groupEntries, fallbackForEntry),
        ...(children ? { children } : {}),
      };
    })
    .sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label));
}
