import {
  AlertDialog,
  Avatar,
  Button,
  Card,
  Chip,
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
  Separator,
  Switch,
  TextField,
  Typography,
  useFilter,
  toast,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  ArrowRotateLeft,
  ChevronDown,
  CircleDollar,
  Folder,
  Persons,
  Plus,
  Power,
  TrashBin,
  Xmark,
} from "@gravity-ui/icons";
import { useMemo, useState } from "react";
import { ActionDropdown } from "@/components/action-dropdown";
import { PageHeader } from "@/components/page-header";
import { RouterLink } from "@/components/router-link";
import { FormAlert } from "@/components/form-feedback";
import { ModalTriggerRegistration } from "@/components/overlay-trigger-registration";
import { CardsSkeleton, EmptyBlock } from "@/components/states";
import { formatDate, formatDuration } from "@/lib/format";
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
    today,
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

  const create = () => {
    if (!name.trim() || !clientId) return;
    const result = addProject({
      name: name.trim(),
      clientId,
      billable: projectBillable,
      status: "active",
      color: "accent",
      lastActivity: today,
      memberIds: assignedMemberIds,
    });
    if (!result.success) {
      setCreateError(error(result.error));
      return;
    }
    toast.success(t("Project is ready"), { description: name.trim() });
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
        <FormAlert title={t("We couldn't update this project")} description={statusError} />
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
                    <Input placeholder={t("e.g. Brand refresh")} />
                    <FieldError />
                  </TextField>

                  <div className="flex flex-col gap-2">
                    <Label>{t("Client")}</Label>
                    <ButtonGroup variant="secondary" size="sm" className="w-full">
                      <Button
                        type="button"
                        aria-label={t("Client")}
                        className="h-9 min-w-0 flex-1 justify-start"
                      >
                        {clients.find((client) => client.id === clientId)?.name ??
                          t("Select a client")}
                      </Button>
                      <Dropdown>
                        <Button
                          isIconOnly
                          aria-label={t("Choose client")}
                          className="h-9 w-9 min-w-9 shrink-0 px-0"
                        >
                          <ButtonGroup.Separator />
                          <ChevronDown aria-hidden="true" className="size-4" />
                        </Button>
                        <Dropdown.Popover>
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
                    </ButtonGroup>
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
                <Typography type="body-sm" color="muted">
                  {t("Select the active members who can track time on {name}.", {
                    name: pendingMembers?.name ?? t("this project"),
                  })}
                </Typography>
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
