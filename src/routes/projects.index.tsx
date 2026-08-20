import {
  Button,
  Chip,
  Description,
  Dropdown,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Switch,
  TextField,
  toast,
} from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, FolderKanban, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { FormAlert } from "@/components/form-feedback";
import { CardsSkeleton, EmptyBlock } from "@/components/states";
import { formatDate, formatDuration, getLocalToday } from "@/lib/format";
import type { Project } from "@/lib/mock-data";
import { useSimulatedLoad, useStore } from "@/lib/store";

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

function ProjectsPage() {
  const { projects, clients, entries, addProject, updateProject } = useStore();
  const loading = useSimulatedLoad(500);
  const [filter, setFilter] = useState<string>("active");
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Project | null>(null);

  const visible = projects.filter((p) => {
    if (filter === "all") return true;
    if (filter === "inactive") return p.status === "on-hold";
    return p.status === filter;
  });
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const projectSeconds = (id: string) =>
    entries.filter((e) => e.projectId === id).reduce((sum, e) => sum + e.seconds, 0);

  const create = () => {
    if (!name.trim() || !clientId) return;
    const result = addProject({
      name: name.trim(),
      clientId,
      status: "active",
      color: "bg-accent",
      lastActivity: getLocalToday(),
      memberIds: ["u1"],
    });
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    toast("Project created", { description: name.trim() });
    setName("");
    setClientId("");
    setCreateError(null);
    setNewOpen(false);
  };

  const toggleProjectStatus = (projectId: string, isActive: boolean, name: string) => {
    const result = updateProject(projectId, { status: isActive ? "on-hold" : "active" });
    if (!result.success) {
      setStatusError(result.error);
      return;
    }
    setStatusError(null);
    toast(`Project ${isActive ? "deactivated" : "activated"}`, { description: name });
  };

  const restoreProject = (project: Project) => {
    const result = updateProject(project.id, { status: "active" });
    if (!result.success) {
      setStatusError(result.error);
      return;
    }
    setStatusError(null);
    toast("Project restored", { description: project.name });
  };

  const archiveProject = () => {
    if (!pendingArchive) return;
    const result = updateProject(pendingArchive.id, { status: "archived" });
    if (!result.success) {
      setStatusError(result.error);
      return;
    }
    toast("Project archived", { description: pendingArchive.name });
    setStatusError(null);
    setPendingArchive(null);
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
                    { id: "inactive", label: "Inactive" },
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

      {statusError ? (
        <FormAlert title="Could not update project" description={statusError} />
      ) : null}

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
            <div
              key={project.id}
              className="rounded-2xl border border-default bg-surface p-5 transition-colors hover:bg-surface-secondary"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="min-w-0 flex-1"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{project.name}</p>
                    <p className="text-sm text-muted">{clientName(project.clientId)}</p>
                  </div>
                  <div className="mt-6 flex items-center justify-between text-sm">
                    <span className="tabular-nums font-medium text-foreground">
                      {formatDuration(projectSeconds(project.id))}
                    </span>
                    <span className="text-muted">Updated {formatDate(project.lastActivity)}</span>
                  </div>
                </Link>
                <div className="flex shrink-0 items-start gap-2">
                  {project.status === "archived" ? (
                    <Chip size="sm" variant="soft">
                      Archived
                    </Chip>
                  ) : (
                    <Switch
                      aria-label={`${project.status === "active" ? "Deactivate" : "Activate"} ${project.name}`}
                      className="shrink-0"
                      isSelected={project.status === "active"}
                      onChange={(selected) =>
                        toggleProjectStatus(project.id, selected, project.name)
                      }
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Content>
                        <Label>{project.status === "active" ? "Active" : "Inactive"}</Label>
                      </Switch.Content>
                    </Switch>
                  )}
                  <Dropdown>
                    <Dropdown.Trigger
                      aria-label={`${project.status === "archived" ? "Archived" : "Project"} actions for ${project.name}`}
                      className="h-8 w-8 min-w-8 p-0"
                    >
                      <MoreHorizontal className="size-4" />
                    </Dropdown.Trigger>
                    <Dropdown.Popover>
                      <Dropdown.Menu
                        onAction={(key) => {
                          if (key === "archive") setPendingArchive(project);
                          if (key === "restore") restoreProject(project);
                        }}
                      >
                        {project.status === "archived" ? (
                          <Dropdown.Item id="restore">
                            <ArchiveRestore className="size-4" />
                            <Label>Restore project</Label>
                          </Dropdown.Item>
                        ) : (
                          <Dropdown.Item id="archive" className="text-danger">
                            <Archive className="size-4" />
                            <Label>Archive project</Label>
                          </Dropdown.Item>
                        )}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={pendingArchive !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingArchive(null);
            setStatusError(null);
          }
        }}
      >
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Archive project?</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                {statusError ? (
                  <FormAlert title="Could not archive project" description={statusError} />
                ) : null}
                <p className="text-sm text-muted">
                  {pendingArchive?.name ?? "This project"} will leave Active and Inactive lists.
                  Existing time entries will remain available in reports and history.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Cancel
                </Button>
                <Button variant="danger" onPress={archiveProject}>
                  Archive project
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={newOpen} onOpenChange={setNewOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>New project</Modal.Heading>
              </Modal.Header>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  create();
                }}
              >
                <Modal.Body className="flex flex-col gap-4">
                  {createError ? (
                    <FormAlert title="Could not create project" description={createError} />
                  ) : null}

                  <TextField
                    isRequired
                    fullWidth
                    name="project-name"
                    value={name}
                    validate={(value) => (value.trim() ? null : "Project name is required")}
                    onChange={(value) => {
                      setName(value);
                      setCreateError(null);
                    }}
                  >
                    <Label>Name</Label>
                    <Input placeholder="e.g. Brand refresh" />
                    <FieldError />
                  </TextField>

                  <div className="flex flex-col gap-2">
                    <Label>Client</Label>
                    <Select
                      aria-label="Client"
                      fullWidth
                      value={clientId || "none"}
                      onChange={(key) => {
                        const value = String(key ?? "none");
                        setClientId(value === "none" ? "" : value);
                        setCreateError(null);
                      }}
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="none" textValue="Select a client" isDisabled>
                            <Label>Select a client</Label>
                          </ListBox.Item>
                          {clients.map((c) => (
                            <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                              <Label>{c.name}</Label>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <Description>Every project is connected to one client.</Description>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" type="button" variant="secondary">
                    Cancel
                  </Button>
                  <Button type="submit" isDisabled={!name.trim() || !clientId}>
                    Create project
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
