import { Button, Label, TextField, Input } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Search, Timer } from "lucide-react";
import { useState } from "react";
import { EntriesTable } from "@/components/entries-table";
import { ExportModal } from "@/components/export-modal";
import { LogTimeModal } from "@/components/log-time-modal";
import { ProjectSelect } from "@/components/project-select";
import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyBlock, TableSkeleton } from "@/components/states";
import { formatDate, formatDuration } from "@/lib/format";
import { useSimulatedLoad, useStore } from "@/lib/store";

export const Route = createFileRoute("/timesheet")({
  head: () => ({
    meta: [
      { title: "Timesheet — Time Blossom" },
      {
        name: "description",
        content: "Browse, filter and export every tracked entry across projects and teammates.",
      },
      { property: "og:title", content: "Timesheet — Time Blossom" },
      {
        property: "og:description",
        content: "A complete log of tracked hours with filters and exports.",
      },
    ],
  }),
  component: TimesheetPage,
});

function TimesheetPage() {
  const { entries, projects } = useStore();
  const loading = useSimulatedLoad(600);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [exportOpen, setExportOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const filtered = entries.filter((e) => {
    const matchesProject =
      projectId === "all" ||
      (projectId === "none" ? e.projectId === null : e.projectId === projectId);
    const matchesQuery = `${e.task} ${e.description ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    return matchesProject && matchesQuery;
  });

  const dates = [...new Set(filtered.map((e) => e.date))].sort((a, b) => (a < b ? 1 : -1));
  const total = filtered.reduce((sum, e) => sum + e.seconds, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheet"
        description="Every entry tracked in this workspace."
        actions={
          <>
            <Button variant="secondary" onPress={() => setLogOpen(true)}>
              Log time
            </Button>
            <Button onPress={() => setExportOpen(true)}>
              <Download className="size-4" />
              Export
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={formatDuration(total)} hint={`${filtered.length} entries`} />
        <StatCard
          label="Billable"
          value={formatDuration(
            filtered.filter((e) => e.billable).reduce((sum, e) => sum + e.seconds, 0),
          )}
        />
        <StatCard label="Days covered" value={String(dates.length)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          className="flex-1"
          fullWidth
          name="timesheet-search"
          value={query}
          onChange={setQuery}
        >
          <Label>Search</Label>
          <Input placeholder="Filter by task or note" />
        </TextField>
        <div className="flex w-full flex-col gap-2 sm:w-56">
          <Label>Project</Label>
          <ProjectSelect
            ariaLabel="Filter by project"
            value={projectId}
            includeAll
            onChange={(value) => setProjectId(String(value))}
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyBlock
          icon={query ? <Search className="size-5" /> : <Timer className="size-5" />}
          title="No entries match your filters"
          description="Try a different project or clear the search to see all tracked time."
          action={
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                setQuery("");
                setProjectId("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {dates.map((date) => {
            const dayEntries = filtered.filter((e) => e.date === date);
            const dayTotal = dayEntries.reduce((sum, e) => sum + e.seconds, 0);
            return (
              <div key={date} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-foreground">{formatDate(date)}</h2>
                  <span className="text-sm tabular-nums text-muted">
                    {formatDuration(dayTotal)}
                  </span>
                </div>
                <EntriesTable entries={dayEntries} showMember />
              </div>
            );
          })}
        </div>
      )}

      <ExportModal isOpen={exportOpen} onOpenChange={setExportOpen} scope="timesheet" />
      <LogTimeModal isOpen={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}
