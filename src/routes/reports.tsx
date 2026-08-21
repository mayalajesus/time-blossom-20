import { Button } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import { ExportModal } from "@/components/export-modal";
import { PageHeader, StatCard } from "@/components/page-header";
import { CardsSkeleton } from "@/components/states";
import { formatDuration } from "@/lib/format";
import { useSimulatedLoad, useStore } from "@/lib/store";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Time Blossom" },
      { name: "description", content: "Weekly totals, billable split and per-project breakdowns." },
      { property: "og:title", content: "Reports — Time Blossom" },
      { property: "og:description", content: "Understand where the team's hours go." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { entries, projects, currentUserId, can } = useStore();
  const loading = useSimulatedLoad(600);
  const [exportOpen, setExportOpen] = useState(false);

  const visibleEntries = can("view-all-reports")
    ? entries
    : entries.filter((entry) => entry.userId === currentUserId);
  const reportScope = can("export-all-reports") ? "All time entries" : "Your time entries";

  const total = visibleEntries.reduce((s, e) => s + e.seconds, 0);
  const billable = visibleEntries.filter((e) => e.billable).reduce((s, e) => s + e.seconds, 0);
  const perProject = [
    ...projects.map((p) => ({
      project: p,
      seconds: visibleEntries
        .filter((e) => e.projectId === p.id)
        .reduce((s, e) => s + e.seconds, 0),
    })),
    {
      project: null,
      seconds: visibleEntries
        .filter((e) => e.projectId === null)
        .reduce((s, e) => s + e.seconds, 0),
    },
  ]
    .filter((row) => row.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
  const max = perProject[0]?.seconds ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Aggregated time across projects and clients."
        actions={
          <Button variant="secondary" onPress={() => setExportOpen(true)}>
            <Download className="size-4" />
            Export
          </Button>
        }
      />

      {loading ? (
        <CardsSkeleton count={3} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total tracked" value={formatDuration(total)} />
            <StatCard label="Billable" value={formatDuration(billable)} />
            <StatCard
              label="Billable rate"
              value={`${total ? Math.round((billable / total) * 100) : 0}%`}
            />
          </div>

          <div className="rounded-2xl border border-default bg-surface p-5">
            <p className="text-sm font-medium text-foreground">Hours by project</p>
            <div className="mt-4 space-y-4">
              {perProject.map(({ project, seconds }) => (
                <div key={project?.id ?? "no-project"} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{project?.name ?? "No project"}</span>
                    <span className="tabular-nums text-muted">{formatDuration(seconds)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-secondary">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${Math.max(4, (seconds / max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <ExportModal isOpen={exportOpen} onOpenChange={setExportOpen} scope={reportScope} />
    </div>
  );
}
