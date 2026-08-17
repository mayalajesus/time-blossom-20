import { Button, Chip, Input, Label, ListBox, Modal, Select, toast } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { CardsSkeleton, EmptyBlock } from "@/components/states";
import { formatDate, formatDuration } from "@/lib/format";
import { useSimulatedLoad, useStore } from "@/lib/store";
import type { ProjectStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — Time Blossom" },
      {
        name: "description",
        content: "Track hours per project, monitor status and open detailed project breakdowns.",
      },
      { property: "og:title", content: "Projects — Time Blossom" },
      {
        property: "og:description",
        content: "All client and internal projects with tracked time at a glance.",
      },
    ],
  }),
  component: ProjectsPage,
});

const statusColor: Record<ProjectStatus, "success" | "warning" | "default"> = {
  active: "success",
  "on-hold": "warning",
  archived: "default",
};

function ProjectsPage() {
  const { projects, clients, entries, addProject } = useStore();
  const loading = useSimulatedLoad(500);
  const [filter, setFilter] = useState<string>("active");
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("c1");

  const visible = projects.filter((p) => filter === "all" || p.status === filter);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const projectSeconds = (id: string) =>
    entries.filter((e) => e.projectId === id).reduce((sum, e) => sum + e.seconds, 0);

  const create = () => {
    if (!name.trim()) return;
    addProject({
      name: name.trim(),
      clientId,
      status: "active",
      color: "bg-accent",
      lastActivity: "2026-08-17",
      memberIds: ["u1"],
    });
    toast("Project created", { description: name.trim() });
    setName("");
    setNewOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Time tracked per project across the workspace."
        actions={
          <>
            <Select
              aria-label="Filter projects"
              value={filter}
              onChange={(key) => setFilter(String(key ?? "all"))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {[
                    { id: "all", label: "All" },
                    { id: "active", label: "Active" },
                    { id: "on-hold", label: "On hold" },
                    { id: "archived", label: "Archived" },
                  ].map((o) => (
                    <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                      <Label>{o.label}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button onPress={() => setNewOpen(true)}>
              <Plus className="size-4" />
              New project
            </Button>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton count={6} />
      ) : visible.length === 0 ? (
        <EmptyBlock
          icon={<FolderKanban className="size-5" />}
          title="No projects here"
          description="Change the status filter or create a new project to get started."
          action={
            <Button size="sm" variant="secondary" onPress={() => setNewOpen(true)}>
              New project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <Link
              key={project.id}
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="rounded-2xl border border-default bg-surface p-5 transition-colors hover:bg-surface-secondary"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{project.name}</p>
                  <p className="text-sm text-muted">{clientName(project.clientId)}</p>
                </div>
                <Chip color={statusColor[project.status]} size="sm" variant="soft">
                  {project.status}
                </Chip>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="tabular-nums font-medium text-foreground">
                  {formatDuration(projectSeconds(project.id))}
                </span>
                <span className="text-muted">Updated {formatDate(project.lastActivity)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={newOpen} onOpenChange={setNewOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>New project</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Name</Label>
                  <Input
                    fullWidth
                    id="project-name"
                    placeholder="e.g. Brand refresh"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select
                    aria-label="Client"
                    fullWidth
                    value={clientId}
                    onChange={(key) => setClientId(String(key ?? "c1"))}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {clients.map((c) => (
                          <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                            <Label>{c.name}</Label>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Cancel
                </Button>
                <Button isDisabled={!name.trim()} onPress={create}>
                  Create project
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
