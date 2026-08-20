import { Button, Chip } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";
import { EntriesTable } from "@/components/entries-table";
import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyBlock, TableSkeleton } from "@/components/states";
import { formatDate, formatDuration } from "@/lib/format";
import { useSimulatedLoad, useStore } from "@/lib/store";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project details — Time Blossom" },
      { name: "description", content: "Hours, members and entries tracked for this project." },
      { property: "og:title", content: "Project details — Time Blossom" },
      { property: "og:description", content: "Breakdown of tracked time for a single project." },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { projects, clients, entries, members } = useStore();
  const loading = useSimulatedLoad(400);

  const project = projects.find((p) => p.id === projectId);
  const projectEntries = entries.filter((e) => e.projectId === projectId);
  const total = projectEntries.reduce((sum, e) => sum + e.seconds, 0);
  const billable = projectEntries.filter((e) => e.billable).reduce((sum, e) => sum + e.seconds, 0);

  if (!project) {
    return (
      <EmptyBlock
        icon={<Clock className="size-5" />}
        title="Project not found"
        description="This project may have been archived or removed."
        action={
          <Link to="/projects">
            <Button size="sm" variant="secondary">
              Back to projects
            </Button>
          </Link>
        }
      />
    );
  }

  const client = clients.find((c) => c.id === project.clientId);
  const team = members.filter((m) => project.memberIds.includes(m.id));

  return (
    <div className="space-y-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Projects
      </Link>

      <PageHeader
        title={project.name}
        description={`${client?.name ?? "No client"} · updated ${formatDate(project.lastActivity)}`}
        actions={
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="soft">
              {project.status}
            </Chip>
            <Chip color={project.billable ? "success" : "default"} size="sm" variant="soft">
              {project.billable ? "Billable" : "Internal"}
            </Chip>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total tracked" value={formatDuration(total)} />
        <StatCard label="Billable" value={formatDuration(billable)} />
        <StatCard
          label="Members"
          value={String(team.length)}
          hint={team.map((m) => m.name).join(", ")}
        />
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : projectEntries.length === 0 ? (
        <EmptyBlock
          icon={<Clock className="size-5" />}
          title="No time tracked"
          description="Entries logged against this project will appear here."
        />
      ) : (
        <EntriesTable entries={projectEntries} showDate showMember />
      )}
    </div>
  );
}
