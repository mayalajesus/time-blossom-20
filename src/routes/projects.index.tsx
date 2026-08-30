import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Separator,
  Switch,
  TextField,
  Typography,
  toast,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  ArrowRotateLeft,
  CircleDollar,
  Folder,
  Persons,
  Plus,
  Power,
  TrashBin,
} from "@gravity-ui/icons";
import { useState } from "react";
import { ActionDropdown } from "@/components/action-dropdown";
import { PageHeader } from "@/components/page-header";
import { RouterLink } from "@/components/router-link";
import { FormAlert } from "@/components/form-feedback";
import { ModalTriggerRegistration } from "@/components/overlay-trigger-registration";
import { CardsSkeleton, EmptyBlock } from "@/components/states";
import { formatDate, formatDuration, getLocalToday } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
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
    deleteProject,
  } = useStore();
  const { locale, t, error } = useI18n();
  const loading = useSimulatedLoad(500);
  const [filter, setFilter] = useState<string>("active");
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectBillable, setProjectBillable] = useState(settings.defaultBillable);
  const [createError, setCreateError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
      color: "accent",
      lastActivity: getLocalToday(),
      memberIds: assignedMemberIds,
    });
    if (!result.success) {
      setCreateError(error(result.error));
      return;
    }
    toast(t("Project created"), { description: name.trim() });
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
      setStatusError(error(result.error));
      return;
    }
    setStatusError(null);
    toast(t(isActive ? "Project deactivated" : "Project activated"), { description: name });
  };

  const restoreProject = (project: Project) => {
    const result = updateProject(project.id, { status: "active" });
    if (!result.success) {
      setStatusError(error(result.error));
      return;
    }
    setStatusError(null);
    toast(t("Project restored"), { description: project.name });
  };

  const toggleProjectBillable = (project: Project) => {
    const result = updateProject(project.id, { billable: !project.billable });
    if (!result.success) {
      setStatusError(error(result.error));
      return;
    }
    setStatusError(null);
    toast(t(project.billable ? "Project marked internal" : "Project marked billable"), {
      description: project.name,
    });
  };

  const archiveProject = () => {
    if (!pendingArchive) return;
    const result = updateProject(pendingArchive.id, { status: "archived" });
    if (!result.success) {
      setStatusError(error(result.error));
      return;
    }
    toast(t("Project archived"), { description: pendingArchive.name });
    setStatusError(null);
    setPendingArchive(null);
  };

  const deleteProjectPermanently = () => {
    if (!pendingDelete) return;
    const result = deleteProject(pendingDelete.id);
    if (!result.success) {
      setDeleteError(error(result.error));
      return;
    }
    toast(t("Project deleted"), { description: pendingDelete.name });
    setDeleteError(null);
    setPendingDelete(null);
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
      setMemberError(error(result.error));
      return;
    }
    toast(t("Project members updated"), { description: pendingMembers.name });
    setPendingMembers(null);
    setMemberError(null);
  };

  const activeMembers = members.filter((member) => member.status === "active");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Projects")}
        description={t("Time tracked per project across the workspace.")}
        actions={
          <>
            <Select
              aria-label={t("Filter projects")}
              className="w-28 shrink-0"
              value={filter}
              variant="secondary"
              onChange={(key) => setFilter(String(key ?? "all"))}
            >
              <Select.Trigger className="h-9 w-full px-3">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {[
                    { id: "all", label: t("All") },
                    { id: "active", label: t("Active") },
                    { id: "inactive", label: t("Inactive") },
                    { id: "archived", label: t("Archived") },
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
                {t("New project")}
              </Button>
            ) : null}
          </>
        }
      />

      {statusError ? (
        <FormAlert title={t("Could not update project")} description={statusError} />
      ) : null}

      {loading ? (
        <CardsSkeleton count={6} />
      ) : visible.length === 0 ? (
        <EmptyBlock
          icon={<Folder className="size-5" />}
          title={t("No projects here")}
          description={t("Change the status filter or create a new project to get started.")}
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
                {t("New project")}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <Card key={project.id} className="min-h-[160px] min-w-0">
              <Card.Header className="flex-row items-start justify-between gap-3 p-0">
                <Card.Title className="min-w-0 flex-1 truncate">
                  <RouterLink
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="block w-full truncate"
                  >
                    {project.name}
                  </RouterLink>
                </Card.Title>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip color={project.billable ? "success" : "default"} size="sm" variant="soft">
                    {project.billable ? t("Billable") : t("Internal")}
                  </Chip>
                  {can("manage-projects") ? (
                    <ActionDropdown
                      ariaLabel={t("{kind} actions for {name}", {
                        kind: project.status === "archived" ? t("Archived") : t("Project"),
                        name: project.name,
                      })}
                      items={[
                        {
                          id: "members",
                          label: t("Manage members"),
                          icon: <Persons className="size-4" />,
                        },
                        ...(project.status === "archived"
                          ? []
                          : [
                              {
                                id: "status",
                                label: project.status === "active" ? t("Active") : t("Inactive"),
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
                          label: project.billable ? t("Make internal") : t("Make billable"),
                          icon: <CircleDollar className="size-4" />,
                        },
                        ...(project.status === "archived"
                          ? [
                              {
                                id: "restore",
                                label: t("Restore project"),
                                icon: <ArrowRotateLeft className="size-4" />,
                              },
                              {
                                id: "delete",
                                label: t("Delete project"),
                                icon: <TrashBin className="size-4" />,
                                tone: "danger" as const,
                              },
                            ]
                          : [
                              {
                                id: "archive",
                                label: t("Archive project"),
                                icon: <Archive className="size-4 text-warning" />,
                                tone: "warning" as const,
                              },
                            ]),
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
                        if (key === "delete") {
                          setDeleteError(null);
                          setPendingDelete(project);
                        }
                      }}
                    />
                  ) : null}
                </div>
              </Card.Header>

              <Card.Content className="min-w-0 p-0">
                <Card.Description className="truncate">
                  {clientName(project.clientId)}
                </Card.Description>
              </Card.Content>

              <Separator />

              <Card.Footer className="mt-auto justify-between gap-4 p-0">
                <div className="min-w-0">
                  <Typography type="body-xs" color="muted" weight="semibold">
                    {t("Tracked")}
                  </Typography>
                  <Typography type="body-sm" weight="semibold" truncate>
                    {formatDuration(projectSeconds(project.id), locale)}
                  </Typography>
                </div>
                <div className="min-w-0 text-right">
                  <Typography type="body-xs" color="muted" weight="semibold">
                    {t("Last activity")}
                  </Typography>
                  <Typography type="body-sm" weight="semibold" truncate>
                    {formatDate(project.lastActivity, locale)}
                  </Typography>
                </div>
              </Card.Footer>
            </Card>
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
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("Archive project?")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                {statusError ? (
                  <FormAlert title={t("Could not archive project")} description={statusError} />
                ) : null}
                <Typography type="body-sm" color="muted">
                  {t(
                    "{name} will leave Active and Inactive lists. Existing time entries will remain available in reports and history.",
                    {
                      name: pendingArchive?.name ?? t("This project"),
                    },
                  )}
                </Typography>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t("Cancel")}
                </Button>
                <Button variant="secondary" className="text-warning" onPress={archiveProject}>
                  {t("Archive project")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <AlertDialog
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialog.Trigger aria-label={t("Delete project")} className="sr-only" tabIndex={-1} />
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading className="text-danger-soft-foreground">
                  {t("Delete project permanently?")}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                {deleteError ? (
                  <FormAlert title={t("Could not delete project")} description={deleteError} />
                ) : null}
                <Typography type="body-sm" color="muted">
                  {t(
                    "This permanently deletes {name} and removes its project link from tracked entries. This action cannot be undone.",
                    { name: pendingDelete?.name ?? t("This project") },
                  )}
                </Typography>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  {t("Cancel")}
                </Button>
                <Button variant="danger" onPress={deleteProjectPermanently}>
                  {t("Delete project")}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <Modal isOpen={newOpen} onOpenChange={setNewOpen}>
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("New project")}</Modal.Heading>
              </Modal.Header>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  create();
                }}
              >
                <Modal.Body className="flex flex-col gap-4">
                  {createError ? (
                    <FormAlert title={t("Could not create project")} description={createError} />
                  ) : null}

                  <TextField
                    isRequired
                    fullWidth
                    name="project-name"
                    value={name}
                    validate={(value) => (value.trim() ? null : t("Project name is required"))}
                    onChange={(value) => {
                      setName(value);
                      setCreateError(null);
                    }}
                  >
                    <Label>{t("Name")}</Label>
                    <Input placeholder={t("e.g. Brand refresh")} />
                    <FieldError />
                  </TextField>

                  <div className="flex flex-col gap-2">
                    <Label>{t("Client")}</Label>
                    <Select
                      aria-label={t("Client")}
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
                          <ListBox.Item id="none" textValue={t("Select a client")} isDisabled>
                            <Label>{t("Select a client")}</Label>
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
                    <Description>{t("Every project is connected to one client.")}</Description>
                  </div>

                  <Switch
                    isSelected={projectBillable}
                    onChange={(selected) => setProjectBillable(selected)}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Content>
                      <Label>{t("Billable")}</Label>
                      <Description>{t("New entries use this as their default.")}</Description>
                    </Switch.Content>
                  </Switch>

                  <div className="space-y-3">
                    <div>
                      <Label>{t("Project members")}</Label>
                      <Description>
                        {t("Only assigned members can track time on this project.")}
                      </Description>
                    </div>
                    {activeMembers.map((member) => (
                      <Switch
                        key={member.id}
                        aria-label={t("Assign {name}", { name: member.name })}
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
                          <Description>{t(member.role)}</Description>
                        </Switch.Content>
                      </Switch>
                    ))}
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" type="button" variant="secondary">
                    {t("Cancel")}
                  </Button>
                  <Button type="submit" isDisabled={!name.trim() || !clientId}>
                    {t("Create project")}
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
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("Manage project members")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                {memberError ? (
                  <FormAlert title={t("Could not update members")} description={memberError} />
                ) : null}
                <Typography type="body-sm" color="muted">
                  {t("Select the active members who can track time on {name}.", {
                    name: pendingMembers?.name ?? t("this project"),
                  })}
                </Typography>
                {activeMembers.map((member) => (
                  <Switch
                    key={member.id}
                    aria-label={t("Assign {name}", { name: member.name })}
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
                      <Description>{t(member.role)}</Description>
                    </Switch.Content>
                  </Switch>
                ))}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t("Cancel")}
                </Button>
                <Button onPress={saveMembers}>{t("Save members")}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
