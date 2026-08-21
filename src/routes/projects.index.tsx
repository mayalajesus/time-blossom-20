import {
  Button,
  Chip,
  Description,
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
import {
  Archive,
  ArchiveRestore,
  CircleDollarSign,
  FolderKanban,
  Plus,
  Power,
  Users,
} from "lucide-react";
import { useState } from "react";
import { ActionDropdown } from "@/components/action-dropdown";
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
  const {
    projects,
    clients,
    entries,
    members,
    settings,
    currentUserId,
    can,
    addProject,
    updateProject,
  } = useStore();
  const loading = useSimulatedLoad(500);
  const [filter, setFilter] = useState<string>("active");
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectBillable, setProjectBillable] = useState(settings.defaultBillable);
  const [createError, setCreateError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Project | null>(null);
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([currentUserId]);
  const [pendingMembers, setPendingMembers] = useState<Project | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

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
      billable: projectBillable,
      status: "active",
      color: "bg-accent",
      lastActivity: getLocalToday(),
      memberIds: assignedMemberIds,
    });
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    toast("Project created", { description: name.trim() });
    setName("");
    setClientId("");
    setProjectBillable(settings.defaultBillable);
    setAssignedMemberIds([currentUserId]);
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

  const toggleProjectBillable = (project: Project) => {
    const result = updateProject(project.id, { billable: !project.billable });
    if (!result.success) {
      setStatusError(result.error);
      return;
    }
    setStatusError(null);
    toast(project.billable ? "Project marked internal" : "Project marked billable", {
      description: project.name,
    });
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

  const openMemberManager = (project: Project) => {
    setMemberError(null);
    setAssignedMemberIds(project.memberIds);
    setPendingMembers(project);
  };

  const saveMembers = () => {
    if (!pendingMembers) return;
    const result = updateProject(pendingMembers.id, { memberIds: assignedMemberIds });
    if (!result.success) {
      setMemberError(result.error);
      return;
    }
    toast("Project members updated", { description: pendingMembers.name });
    setPendingMembers(null);
    setMemberError(null);
  };

  const activeMembers = members.filter((member) => member.status === "active");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Time tracked per project across the workspace."
        actions={
          <>
            <Select
              aria-label="Filter projects"
              className="w-28 shrink-0"
              value={filter}
              variant="secondary"
              onChange={(key) => setFilter(String(key ?? "all"))}
            >
              <Select.Trigger className="h-9 w-full rounded-3xl px-3">
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
            {can("manage-projects") ? (
              <Button
                onPress={() => {
                  setProjectBillable(settings.defaultBillable);
                  setAssignedMemberIds([currentUserId]);
                  setNewOpen(true);
                }}
              >
                <Plus className="size-4" />
                New project
              </Button>
            ) : null}
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
            can("manage-projects") ? (
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  setProjectBillable(settings.defaultBillable);
                  setAssignedMemberIds([currentUserId]);
                  setNewOpen(true);
                }}
              >
                New project
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <article
              key={project.id}
              className="flex min-h-[160px] min-w-0 flex-col rounded-2xl border border-default bg-surface p-4 transition-colors hover:bg-surface-secondary"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate font-medium text-foreground">{project.name}</p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {clientName(project.clientId)}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip color={project.billable ? "success" : "default"} size="sm" variant="soft">
                    {project.billable ? "Billable" : "Internal"}
                  </Chip>
                  {can("manage-projects") ? (
                    <ActionDropdown
                      ariaLabel={`${project.status === "archived" ? "Archived" : "Project"} actions for ${project.name}`}
                      items={[
                        {
                          id: "members",
                          label: "Manage members",
                          icon: <Users className="size-4" />,
                        },
                        ...(project.status === "archived"
                          ? []
                          : [
                              {
                                id: "status",
                                label: project.status === "active" ? "Active" : "Inactive",
                                icon: <Power className="size-4" />,
                                trailing: (
                                  <Switch
                                    aria-hidden="true"
                                    className="pointer-events-none"
                                    isReadOnly
                                    isSelected={project.status === "active"}
                                  >
                                    <Switch.Control>
                                      <Switch.Thumb />
                                    </Switch.Control>
                                  </Switch>
                                ),
                              },
                            ]),
                        {
                          id: "billable",
                          label: project.billable ? "Make internal" : "Make billable",
                          icon: <CircleDollarSign className="size-4" />,
                        },
                        project.status === "archived"
                          ? {
                              id: "restore",
                              label: "Restore project",
                              icon: <ArchiveRestore className="size-4" />,
                            }
                          : {
                              id: "archive",
                              label: "Archive project",
                              icon: <Archive className="size-4" />,
                              tone: "danger" as const,
                            },
                      ]}
                      onAction={(key) => {
                        if (key === "members") openMemberManager(project);
                        if (key === "status") {
                          toggleProjectStatus(
                            project.id,
                            project.status !== "active",
                            project.name,
                          );
                        }
                        if (key === "billable") toggleProjectBillable(project);
                        if (key === "archive") setPendingArchive(project);
                        if (key === "restore") restoreProject(project);
                      }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-auto flex items-end justify-between gap-4 pt-4 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted">Tracked</p>
                  <p className="truncate tabular-nums font-medium text-foreground">
                    {formatDuration(projectSeconds(project.id))}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-xs text-muted">Last activity</p>
                  <p className="truncate text-foreground">{formatDate(project.lastActivity)}</p>
                </div>
              </div>
            </article>
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

                  <Switch
                    isSelected={projectBillable}
                    onChange={(selected) => setProjectBillable(selected)}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Content>
                      <Label>Billable</Label>
                      <Description>New entries use this as their default.</Description>
                    </Switch.Content>
                  </Switch>

                  <div className="space-y-3">
                    <div>
                      <Label>Project members</Label>
                      <Description>
                        Only assigned members can track time on this project.
                      </Description>
                    </div>
                    {activeMembers.map((member) => (
                      <Switch
                        key={member.id}
                        aria-label={`Assign ${member.name}`}
                        isSelected={assignedMemberIds.includes(member.id)}
                        onChange={(selected) =>
                          setAssignedMemberIds((current) =>
                            selected
                              ? [...new Set([...current, member.id])]
                              : current.filter((id) => id !== member.id),
                          )
                        }
                      >
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                          <Label>{member.name}</Label>
                          <Description>{member.role}</Description>
                        </Switch.Content>
                      </Switch>
                    ))}
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

      <Modal
        isOpen={pendingMembers !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMembers(null);
            setMemberError(null);
          }
        }}
      >
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Manage project members</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                {memberError ? (
                  <FormAlert title="Could not update members" description={memberError} />
                ) : null}
                <p className="text-sm text-muted">
                  Select the active members who can track time on{" "}
                  {pendingMembers?.name ?? "this project"}.
                </p>
                {activeMembers.map((member) => (
                  <Switch
                    key={member.id}
                    aria-label={`Assign ${member.name}`}
                    isSelected={assignedMemberIds.includes(member.id)}
                    onChange={(selected) =>
                      setAssignedMemberIds((current) =>
                        selected
                          ? [...new Set([...current, member.id])]
                          : current.filter((id) => id !== member.id),
                      )
                    }
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Content>
                      <Label>{member.name}</Label>
                      <Description>{member.role}</Description>
                    </Switch.Content>
                  </Switch>
                ))}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Cancel
                </Button>
                <Button onPress={saveMembers}>Save members</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
