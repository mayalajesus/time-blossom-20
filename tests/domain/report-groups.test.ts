import { describe, expect, it } from "vitest";
import type { BillingPreference } from "../../src/lib/billing";
import type { Client, Member, Project, TimeEntry } from "../../src/lib/domain";
import { buildReportGroups } from "../../src/lib/report-groups";

const members: Member[] = [
  {
    id: "u1",
    name: "Maya Silva",
    email: "maya@example.com",
    initials: "MS",
    role: "Owner",
    status: "active",
  },
];
const clients: Client[] = [{ id: "c1", name: "Acme", contact: "acme@example.com" }];
const projects: Project[] = [
  {
    id: "p1",
    name: "Website",
    clientId: "c1",
    billable: true,
    status: "active",
    color: "#000000",
    lastActivity: "2026-09-01",
    memberIds: ["u1"],
  },
];
const fallback: BillingPreference = { hourlyRate: 100, currency: "BRL" };

function entry(id: string, task: string, seconds: number, billable = true): TimeEntry {
  return {
    id,
    date: "2026-09-01",
    start: "09:00",
    end: "10:00",
    seconds,
    userId: "u1",
    projectId: "p1",
    task,
    billable,
  };
}

describe("report groups", () => {
  it("groups by project, creates task children and preserves billing totals", () => {
    const groups = buildReportGroups(
      [entry("e1", "Design", 3_600), entry("e2", "Review", 1_800, false)],
      "project",
      "task",
      members,
      projects,
      clients,
      "en-US",
      () => fallback,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: "p1",
      label: "Website",
      seconds: 5_400,
      billable: 3_600,
      records: 2,
      billableValue: { BRL: 100 },
    });
    expect(groups[0]?.children?.map((group) => group.label)).toEqual(["Design", "Review"]);
  });
});
