import {
  AlertDialog,
  Avatar,
  Button,
  Chip,
  ColorSwatchPicker,
  Description,
  EmptyState,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  SearchField,
  ButtonGroup,
  Dropdown,
  Switch,
  Table,
  TextField,
  Typography,
  useFilter,
  toast,
  parseColor,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  ArrowRotateLeft,
  ChevronDown,
  Copy,
  Folder,
  Pencil,
  Persons,
  Plus,
  Power,
  TrashBin,
  Xmark,
} from "@gravity-ui/icons";
import { useMemo, useState } from "react";
import { ActionDropdown } from "@/components/action-dropdown";
import { BillableIndicator } from "@/components/billable-indicator";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { RouterLink } from "@/components/router-link";
import { FormAlert } from "@/components/form-feedback";
import { ModalTriggerRegistration } from "@/components/overlay-trigger-registration";
import { EmptyBlock } from "@/components/states";
import { formatDate, formatDuration } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Project } from "@/lib/mock-data";
import {
  defaultProjectColor,
  projectColorOptions,
  projectColorTextValue,
  projectColorValue,
} from "@/lib/project-colors";
import { useStore } from "@/lib/store";

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
    today,
    currentUserId,
    can,
    addProject,
    updateProject,
    deleteProject,
  } = useStore();
  const { locale, t, error } = useI18n();
  const [filter, setFilter] = useState<string>("active");
  const [newOpen, setNewOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectColor, setProjectColor] = useState(defaultProjectColor);
  const [projectBillable, setProjectBillable] = useState(settings.defaultBillable);
  const [createError, setCreateError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([currentUserId]);
  const [pendingMembers, setPendingMembers] = useState<Project | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });
  const pendingDeleteHasEntries = pendingDelete
    ? entries.some((entry) => entry.projectId === pendingDelete.id)
    : false;

  const visible = projects.filter((p) => {
    if (filter === "all") return true;
    if (filter === "inactive") return p.status === "on-hold";
    return p.status === filter;
  });
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const projectSeconds = (id: string) =>
    entries.filter((e) => e.projectId === id).reduce((sum, e) => sum + e.seconds, 0);

  const openProjectForm = (project?: Project) => {
    setCreateError(null);
    setEditingProject(project ?? null);
    setName(project?.name ?? "");
    setClientId(project?.clientId ?? "");
    setProjectColor(projectColorValue(project?.color));
    setProjectBillable(project?.billable ?? settings.defaultBillable);
    setAssignedMemberIds(project?.memberIds ?? [currentUserId]);
    setMemberQuery("");
    setNewOpen(true);
  };

  const closeProjectForm = () => {
    setNewOpen(false);
    setEditingProject(null);
    setCreateError(null);
    setMemberQuery("");
  };

  const saveProject = () => {
    if (!name.trim() || !clientId) return;
    const result = editingProject
      ? updateProject(editingProject.id, {
          name: name.trim(),
          clientId,
          billable: projectBillable,
          color: projectColor,
          memberIds: assignedMemberIds,
        })
      : addProject({
          name: name.trim(),
          clientId,
          billable: projectBillable,
          status: "active",
          color: projectColor,
          lastActivity: today,
          memberIds: assignedMemberIds,
        });
    if (!result.success) {
      setCreateError(error(result.error));
      return;
    }
    toast.success(t(editingProject ? "Project updated" : "Project is ready"), {
      description: name.trim(),
    });
    closeProjectForm();
  };

  const duplicateProject = (project: Project) => {
    const { id: _id, status: _status, ...copy } = project;
    const result = addProject({
      ...copy,
      name: t("Copy of {name}", { name: project.name }),
      color: projectColorValue(project.color),
      status: "active",
      lastActivity: today,
    });
    if (!result.success) {
      setStatusError(error(result.error));
      return;
    }
    setStatusError(null);
    toast.success(t("Project duplicated"), { description: project.name });
  };

  const toggleProjectStatus = (projectId: string, isActive: boolean, name: string) => {
    const result = updateProject(projectId, { status: isActive ? "on-hold" : "active" });
    if (!result.success) {
      setStatusError(error(result.error));
      return;
    }
    setStatusError(null);
    toast.success(t(isActive ? "Project is on hold" : "Project is active again"), {
      description: name,
    });
  };

  const restoreProject = (project: Project) => {
    const result = updateProject(project.id, { status: "active" });
    if (!result.success) {
      setStatusError(error(result.error));
      return;
    }
    setStatusError(null);
    toast.success(t("Project is active again"), { description: project.name });
  };

  const toggleProjectBillable = (project: Project) => {
    const result = updateProject(project.id, { billable: !project.billable });
    if (!result.success) {
      setStatusError(error(result.error));
      return;
    }
    setStatusError(null);
    toast.success(t(project.billable ? "Project is internal now" : "Project is billable now"), {
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
    toast.success(t("Project archived"), { description: pendingArchive.name });
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
    toast.success(t("Project deleted"), { description: pendingDelete.name });
    setDeleteError(null);
    setPendingDelete(null);
  };

  const openMemberManager = (project: Project) => {
    setMemberError(null);
    setAssignedMemberIds(project.memberIds);
    setMemberQuery("");
    setPendingMembers(project);
  };

  const saveMembers = () => {
    if (!pendingMembers) return;
    const result = updateProject(pendingMembers.id, { memberIds: assignedMemberIds });
    if (!result.success) {
      setMemberError(error(result.error));
      return;
    }
    toast.success(t("Project access updated"), { description: pendingMembers.name });
    setPendingMembers(null);
    setMemberError(null);
    setMemberQuery("");
  };

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members],
  );
  const assignedMemberIdSet = useMemo(() => new Set(assignedMemberIds), [assignedMemberIds]);
  const assignedMembers = useMemo(
    () => activeMembers.filter((member) => assignedMemberIdSet.has(member.id)),
    [activeMembers, assignedMemberIdSet],
  );
  const memberSearchResults = useMemo(() => {
    const query = memberQuery.trim();

    return activeMembers
      .filter(
        (member) =>
          member.id !== currentUserId &&
          !assignedMemberIdSet.has(member.id) &&
          (query.length === 0 || contains(member.name, query) || contains(member.email, query)),
      )
      .slice(0, 50);
  }, [activeMembers, assignedMemberIdSet, contains, currentUserId, memberQuery]);
  const addMember = (memberId: string) => {
    setAssignedMemberIds((current) =>
      current.includes(memberId) ? current : [...current, memberId],
    );
    setMemberQuery("");
  };
  const projectFilterOptions = [
    { id: "all", label: t("All") },
    { id: "active", label: t("Active") },
    { id: "inactive", label: t("Inactive") },
    { id: "archived", label: t("Archived") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Projects")}
        description={t("Time tracked per project across the workspace.")}
        actions={
          <>
            <ButtonGroup variant="tertiary" size="sm" className="w-28 shrink-0">
              <Button
                type="button"
                aria-label={t("Filter projects")}
                className="h-9 min-w-0 flex-1 justify-start px-3"
              >
                {projectFilterOptions.find((option) => option.id === filter)?.label}
              </Button>
              <Dropdown>
                <Button
                  isIconOnly
                  variant="tertiary"
                  aria-label={t("Open project filters")}
                  className="h-9 w-9 min-w-9 shrink-0 px-0"
                >
                  <ButtonGroup.Separator />
                  <ChevronDown aria-hidden="true" className="size-4" />
                </Button>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    aria-label={t("Filter projects")}
                    selectionMode="single"
                    selectedKeys={new Set([filter])}
                    onAction={(key) => setFilter(String(key))}
                  >
                    {projectFilterOptions.map((option) => (
                      <Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
                        <Label>{option.label}</Label>
                        <Dropdown.ItemIndicator />
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </ButtonGroup>
            {can("manage-projects") ? (
              <Button onPress={() => openProjectForm()}>
                <Plus className="size-4" />
                {t("New project")}
              </Button>
            ) : null}
          </>
        }
      />

      {statusError ? (
        <FormAlert title={t("We couldn't update this project")} description={statusError} />
      ) : null}

      {visible.length === 0 ? (
        <EmptyBlock
          icon={<Folder className="size-5" />}
          title={t("No projects here")}
          description={t("Change the status filter or create a new project to get started.")}
          action={
            can("manage-projects") ? (
              <Button size="sm" variant="secondary" onPress={() => openProjectForm()}>
                {t("New project")}
              </Button>
            ) : null
          }
        />
      ) : (
        <DataTable
          label={t("Projects")}
          minWidth="min-w-[820px]"
          scrollHint={t("Scroll horizontally to see all columns")}
        >
          <Table.Header>
            <Table.Column isRowHeader>{t("Project")}</Table.Column>
            <Table.Column>{t("Client")}</Table.Column>
            <Table.Column>{t("Status")}</Table.Column>
            <Table.Column>{t("Billing")}</Table.Column>
            <Table.Column>{t("Tracked")}</Table.Column>
            <Table.Column>{t("Last activity")}</Table.Column>
            <Table.Column aria-label={t("Actions")}>{""}</Table.Column>
          </Table.Header>
          <Table.Body>
            {visible.map((project) => (
              <Table.Row key={project.id}>
                <Table.Cell>
                  <RouterLink
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="block max-w-64 truncate font-semibold"
                    style={{ color: projectColorTextValue(project.color) }}
                  >
                    {project.name}
                  </RouterLink>
                </Table.Cell>
                <Table.Cell className="max-w-52 truncate">
                  {clientName(project.clientId)}
                </Table.Cell>
                <Table.Cell>
                  <Chip size="sm" variant="secondary" color="default">
                    {t(
                      project.status === "on-hold"
                        ? "Inactive"
                        : project.status === "archived"
                          ? "Archived"
                          : "Active",
                    )}
                  </Chip>
                </Table.Cell>
                <Table.Cell>
                  <BillableIndicator billable={project.billable} />
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  {formatDuration(projectSeconds(project.id), locale)}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  {formatDate(project.lastActivity, locale)}
                </Table.Cell>
                <Table.Cell>
                  {can("manage-projects") ? (
                    <div className="flex justify-end">
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
                          {
                            id: "edit",
                            label: t("Edit project"),
                            icon: <Pencil className="size-4" />,
                          },
                          {
                            id: "duplicate",
                            label: t("Duplicate project"),
                            icon: <Copy className="size-4" />,
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
                            icon: (
                              <BillableIndicator
                                billable={!project.billable}
                                mode="icon"
                                size="md"
                              />
                            ),
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
                                  icon: (
                                    <Chip
                                      color="warning"
                                      size="sm"
                                      variant="tertiary"
                                      className="px-0 py-0"
                                    >
                                      <Archive className="size-4" />
                                    </Chip>
                                  ),
                                  tone: "warning" as const,
                                },
                              ]),
                        ]}
                        onAction={(key) => {
                          if (key === "members") openMemberManager(project);
                          if (key === "edit") openProjectForm(project);
                          if (key === "duplicate") duplicateProject(project);
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
                    </div>
                  ) : null}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </DataTable>
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
                  <FormAlert
                    title={t("We couldn't archive this project")}
                    description={statusError}
                  />
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
                <Button variant="secondary" onPress={archiveProject}>
                  <Chip color="warning" size="sm" variant="tertiary" className="px-0 py-0">
                    {t("Archive project")}
                  </Chip>
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
                <AlertDialog.Heading>{t("Delete project permanently?")}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                {deleteError ? (
                  <FormAlert
                    title={t("We couldn't delete this project")}
                    description={deleteError}
                  />
                ) : null}
                <Typography type="body-sm" color="muted">
                  {pendingDeleteHasEntries
                    ? error(
                        "This project has tracked time. Keep it archived to preserve reports and history.",
                      )
                    : t("This permanently deletes {name}. This action cannot be undone.", {
                        name: pendingDelete?.name ?? t("This project"),
                      })}
                </Typography>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  {t("Cancel")}
                </Button>
                <Button
                  variant="danger"
                  isDisabled={pendingDeleteHasEntries}
                  onPress={deleteProjectPermanently}
                >
                  {t("Delete project")}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <Modal
        isOpen={newOpen}
        onOpenChange={(open) => {
          if (open) setNewOpen(true);
          else closeProjectForm();
        }}
      >
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t(editingProject ? "Edit project" : "New project")}</Modal.Heading>
              </Modal.Header>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  saveProject();
                }}
              >
                <Modal.Body className="flex flex-col gap-4">
                  {createError ? (
                    <FormAlert
                      title={t("We couldn't create this project")}
                      description={createError}
                    />
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
                    <Input variant="secondary" placeholder={t("e.g. Brand refresh")} />
                    <FieldError />
                  </TextField>

                  <div className="space-y-2">
                    <Label>{t("Project color")}</Label>
                    <ColorSwatchPicker
                      aria-label={t("Project color")}
                      value={parseColor(projectColorValue(projectColor))}
                      onChange={(color) =>
                        setProjectColor(typeof color === "string" ? color : color.toString("hex"))
                      }
                      size="md"
                    >
                      {projectColorOptions.map((option) => (
                        <ColorSwatchPicker.Item
                          key={option.id}
                          color={parseColor(option.value)}
                          aria-label={t(option.label)}
                        >
                          <ColorSwatchPicker.Swatch />
                          <ColorSwatchPicker.Indicator />
                        </ColorSwatchPicker.Item>
                      ))}
                    </ColorSwatchPicker>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>{t("Client")}</Label>
                    <Dropdown>
                      <Button
                        type="button"
                        variant="secondary"
                        aria-label={t("Client")}
                        className="h-9 w-full justify-between gap-2 px-3"
                      >
                        <span className="truncate">
                          {clients.find((client) => client.id === clientId)?.name ??
                            t("Select a client")}
                        </span>
                        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
                      </Button>
                      <Dropdown.Popover
                        className="max-w-[calc(100vw-2rem)] min-w-0"
                        style={{ width: "var(--trigger-width)", maxWidth: "calc(100vw - 2rem)" }}
                      >
                        <Dropdown.Menu
                          aria-label={t("Client")}
                          selectionMode="single"
                          selectedKeys={new Set([clientId || "none"])}
                          onAction={(key) => {
                            const value = String(key);
                            setClientId(value === "none" ? "" : value);
                            setCreateError(null);
                          }}
                        >
                          <Dropdown.Item id="none" textValue={t("Select a client")} isDisabled>
                            <Label>{t("Select a client")}</Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>
                          {clients.map((c) => (
                            <Dropdown.Item key={c.id} id={c.id} textValue={c.name}>
                              <Label>{c.name}</Label>
                              <Dropdown.ItemIndicator />
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
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
                      <div className="flex items-center gap-2">
                        <BillableIndicator billable={projectBillable} mode="icon" />
                        <Label>{t("Billable")}</Label>
                      </div>
                      <Description>{t("New entries use this as their default.")}</Description>
                    </Switch.Content>
                  </Switch>

                  <div className="space-y-3">
                    <div>
                      <Label>{t("Project members")}</Label>
                    </div>
                    <Dropdown>
                      <Button
                        type="button"
                        variant="secondary"
                        aria-label={t("Add project members")}
                        className="h-9 w-full justify-between gap-2 px-3"
                      >
                        <span className="truncate text-sm">{t("Add members")}</span>
                        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
                      </Button>
                      <Dropdown.Popover
                        className="max-w-[calc(100vw-2rem)] min-w-0"
                        style={{ width: "var(--trigger-width)", maxWidth: "calc(100vw - 2rem)" }}
                        onOpenChange={(open) => {
                          if (!open) setMemberQuery("");
                        }}
                      >
                        <div className="flex flex-col gap-2 p-2">
                          <SearchField
                            autoFocus
                            aria-label={t("Search members")}
                            name="new-project-member-search"
                            value={memberQuery}
                            onChange={setMemberQuery}
                            variant="secondary"
                          >
                            <SearchField.Group>
                              <SearchField.SearchIcon />
                              <SearchField.Input placeholder={`${t("Search members")}...`} />
                              <SearchField.ClearButton />
                            </SearchField.Group>
                          </SearchField>
                          {memberSearchResults.length === 0 ? (
                            <EmptyState>{t("No matching active members")}</EmptyState>
                          ) : (
                            <Dropdown.Menu
                              aria-label={t("Active members")}
                              selectionMode="single"
                              onAction={(key) => addMember(String(key))}
                              className="max-h-60 overflow-y-auto"
                            >
                              {memberSearchResults.map((member) => (
                                <Dropdown.Item
                                  key={member.id}
                                  id={member.id}
                                  textValue={`${member.name} ${member.email}`}
                                >
                                  <Avatar size="sm" className="shrink-0">
                                    <Avatar.Fallback>{member.initials}</Avatar.Fallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <Typography type="body-sm" truncate>
                                      {member.name}
                                    </Typography>
                                  </div>
                                </Dropdown.Item>
                              ))}
                            </Dropdown.Menu>
                          )}
                        </div>
                      </Dropdown.Popover>
                    </Dropdown>
                    <div className="space-y-2">
                      <Label>{t("Selected members")}</Label>
                      {assignedMembers.length === 0 ? (
                        <Typography type="body-sm" color="muted">
                          {t("No members selected")}
                        </Typography>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {assignedMembers.map((member) => (
                            <Chip key={member.id} size="sm" variant="soft">
                              <Chip.Label>{member.name}</Chip.Label>
                              {member.id === currentUserId ? null : (
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="tertiary"
                                  aria-label={t("Remove {name}", { name: member.name })}
                                  className="-mr-1 size-5 min-w-5 p-0"
                                  onPress={() =>
                                    setAssignedMemberIds((current) =>
                                      current.filter((id) => id !== member.id),
                                    )
                                  }
                                >
                                  <Xmark aria-hidden="true" className="size-3" />
                                </Button>
                              )}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" type="button" variant="secondary">
                    {t("Cancel")}
                  </Button>
                  <Button type="submit" isDisabled={!name.trim() || !clientId}>
                    {t(editingProject ? "Save changes" : "Create project")}
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
            setMemberQuery("");
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
                  <FormAlert
                    title={t("We couldn't update project access")}
                    description={memberError}
                  />
                ) : null}
                <Dropdown>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={t("Add project members")}
                    className="h-9 w-full justify-between gap-2 px-3"
                  >
                    <span className="truncate text-sm">{t("Add members")}</span>
                    <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
                  </Button>
                  <Dropdown.Popover
                    className="max-w-[calc(100vw-2rem)] min-w-0"
                    style={{ width: "var(--trigger-width)", maxWidth: "calc(100vw - 2rem)" }}
                    onOpenChange={(open) => {
                      if (!open) setMemberQuery("");
                    }}
                  >
                    <div className="flex flex-col gap-2 p-2">
                      <SearchField
                        autoFocus
                        aria-label={t("Search members")}
                        name="project-member-search"
                        value={memberQuery}
                        onChange={setMemberQuery}
                        variant="secondary"
                      >
                        <SearchField.Group>
                          <SearchField.SearchIcon />
                          <SearchField.Input placeholder={`${t("Search members")}...`} />
                          <SearchField.ClearButton />
                        </SearchField.Group>
                      </SearchField>
                      {memberSearchResults.length === 0 ? (
                        <EmptyState>{t("No matching active members")}</EmptyState>
                      ) : (
                        <Dropdown.Menu
                          aria-label={t("Active members")}
                          selectionMode="single"
                          onAction={(key) => addMember(String(key))}
                          className="max-h-60 overflow-y-auto"
                        >
                          {memberSearchResults.map((member) => (
                            <Dropdown.Item
                              key={member.id}
                              id={member.id}
                              textValue={`${member.name} ${member.email}`}
                            >
                              <Avatar size="sm" className="shrink-0">
                                <Avatar.Fallback>{member.initials}</Avatar.Fallback>
                              </Avatar>
                              <div className="min-w-0">
                                <Typography type="body-sm" truncate>
                                  {member.name}
                                </Typography>
                              </div>
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      )}
                    </div>
                  </Dropdown.Popover>
                </Dropdown>
                <div className="space-y-2">
                  <Label>{t("Selected members")}</Label>
                  {assignedMembers.length === 0 ? (
                    <Typography type="body-sm" color="muted">
                      {t("No members selected")}
                    </Typography>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {assignedMembers.map((member) => (
                        <Chip key={member.id} size="sm" variant="soft">
                          <Chip.Label>{member.name}</Chip.Label>
                          {member.id === currentUserId ? null : (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="tertiary"
                              aria-label={t("Remove {name}", { name: member.name })}
                              className="-mr-1 size-5 min-w-5 p-0"
                              onPress={() =>
                                setAssignedMemberIds((current) =>
                                  current.filter((id) => id !== member.id),
                                )
                              }
                            >
                              <Xmark aria-hidden="true" className="size-3" />
                            </Button>
                          )}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
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
