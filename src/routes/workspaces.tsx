import {
  Avatar,
  Button,
  Card,
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
import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ExternalLink, Layers3, Pencil, Plus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { FormAlert } from "@/components/form-feedback";
import { ModalTriggerRegistration } from "@/components/overlay-trigger-registration";
import { PageHeader } from "@/components/page-header";
import { EmptyBlock } from "@/components/states";
import { useI18n } from "@/lib/i18n";
import { useStore, type WorkspaceSummary } from "@/lib/store";

export const Route = createFileRoute("/workspaces")({
  head: () => ({
    meta: [
      { title: "Workspaces — Time Blossom" },
      { name: "description", content: "Create and manage your Time Blossom workspaces." },
      { property: "og:title", content: "Workspaces — Time Blossom" },
      {
        property: "og:description",
        content: "Switch between focused workspaces and shared teams.",
      },
    ],
  }),
  component: WorkspacesPage,
});

type Confirmation = { kind: "archive" | "restore" | "leave"; workspace: WorkspaceSummary } | null;

function initialsForWorkspace(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function WorkspaceLogo({
  workspace,
  size = "md",
}: {
  workspace: WorkspaceSummary;
  size?: "sm" | "md";
}) {
  const avatarSize: "sm" | "md" = size === "sm" ? "sm" : "md";
  return (
    <Avatar size={avatarSize} aria-label={workspace.name} className="shrink-0">
      {workspace.logoDataUrl ? <Avatar.Image alt="" src={workspace.logoDataUrl} /> : null}
      <Avatar.Fallback>{initialsForWorkspace(workspace.name)}</Avatar.Fallback>
    </Avatar>
  );
}

function readLogo(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return Promise.reject(new Error("type"));
  }
  if (file.size > 500_000) return Promise.reject(new Error("size"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("read"));
    });
    reader.addEventListener("error", () => reject(new Error("read")));
    reader.readAsDataURL(file);
  });
}

function WorkspacesPage() {
  const {
    workspaces,
    activeWorkspaceId,
    settings,
    timer,
    createWorkspace,
    updateWorkspace,
    setWorkspaceSettings,
    archiveWorkspace,
    restoreWorkspace,
    leaveWorkspace,
    switchWorkspace,
    pauseTimer,
  } = useStore();
  const { t, error } = useI18n();
  const navigate = Route.useNavigate();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editWorkspace, setEditWorkspace] = useState<WorkspaceSummary | null>(null);
  const [name, setName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [defaultBillable, setDefaultBillable] = useState(settings.defaultBillable);
  const [weekStart, setWeekStart] = useState<"monday" | "sunday">(settings.weekStart);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);

  const owned = workspaces.filter((workspace) => workspace.isOwned);
  const shared = workspaces.filter((workspace) => !workspace.isOwned);

  useEffect(() => {
    if (editWorkspace) {
      setName(editWorkspace.name);
      setLogoDataUrl(editWorkspace.logoDataUrl);
      setDefaultBillable(settings.defaultBillable);
      setWeekStart(settings.weekStart);
    }
  }, [editWorkspace, settings.defaultBillable, settings.weekStart]);

  const resetForm = () => {
    setName("");
    setLogoDataUrl(null);
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (workspace: WorkspaceSummary) => {
    setFormError(null);
    setEditWorkspace(workspace);
  };

  const handleLogo = (file: File | undefined) => {
    if (!file) return;
    void readLogo(file)
      .then(setLogoDataUrl)
      .then(() => setFormError(null))
      .catch((reason: Error) => {
        setFormError(
          reason.message === "type"
            ? "Choose a PNG, JPG or WebP logo."
            : reason.message === "size"
              ? "Workspace logos must be smaller than 500 KB."
              : "The workspace logo could not be read.",
        );
      });
  };

  const submitCreate = () => {
    const result = createWorkspace(name);
    if (!result.success) {
      setFormError(error(result.error));
      return;
    }
    if (logoDataUrl && result.id) {
      const updateResult = updateWorkspace(result.id, { logoDataUrl });
      if (!updateResult.success) {
        setFormError(error(updateResult.error));
        return;
      }
    }
    toast(t("Workspace created"), { description: name.trim() });
    setCreateOpen(false);
    resetForm();
    navigate({ to: "/tracker" });
  };

  const submitEdit = () => {
    if (!editWorkspace) return;
    if (!name.trim()) {
      setFormError(t("Workspace name is required"));
      return;
    }
    const settingsResult = setWorkspaceSettings({ defaultBillable, weekStart });
    if (!settingsResult.success) {
      setFormError(error(settingsResult.error));
      return;
    }
    const result = updateWorkspace(editWorkspace.id, { name, logoDataUrl });
    if (!result.success) {
      setFormError(error(result.error));
      return;
    }
    toast(t("Workspace updated"), { description: name.trim() });
    setEditWorkspace(null);
    resetForm();
  };

  const openWorkspace = (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) {
      navigate({ to: "/tracker" });
      return;
    }
    if (timer.status === "running") {
      setPendingWorkspaceId(workspaceId);
      setSwitchOpen(true);
      return;
    }
    const result = switchWorkspace(workspaceId);
    if (!result.success) {
      setPageError(error(result.error));
      return;
    }
    setPageError(null);
    navigate({ to: "/tracker" });
  };

  const confirmSwitch = () => {
    if (!pendingWorkspaceId) return;
    pauseTimer();
    const result = switchWorkspace(pendingWorkspaceId);
    if (!result.success) {
      setPageError(error(result.error));
      return;
    }
    setSwitchOpen(false);
    setPendingWorkspaceId(null);
    navigate({ to: "/tracker" });
  };

  const confirmWorkspaceAction = () => {
    if (!confirmation) return;
    const result =
      confirmation.kind === "archive"
        ? archiveWorkspace(confirmation.workspace.id)
        : confirmation.kind === "restore"
          ? restoreWorkspace(confirmation.workspace.id)
          : leaveWorkspace(confirmation.workspace.id);
    if (!result.success) {
      setPageError(error(result.error));
      return;
    }
    toast(
      t(
        confirmation.kind === "archive"
          ? "Workspace archived"
          : confirmation.kind === "restore"
            ? "Workspace restored"
            : "Left workspace",
      ),
    );
    setConfirmation(null);
  };

  const renderWorkspace = (workspace: WorkspaceSummary) => {
    const isCurrent = workspace.id === activeWorkspaceId;
    const canEdit = workspace.isOwned && workspace.status === "active";
    return (
      <Card
        key={workspace.id}
        className={`flex min-h-44 min-w-0 flex-col p-4 ${isCurrent ? "ring-1 ring-focus/60" : ""}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <WorkspaceLogo workspace={workspace} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-foreground">{workspace.name}</h2>
                <p className="mt-1 truncate text-sm text-muted">
                  {workspace.isOwned
                    ? t("Owned by you")
                    : t("Owned by {name}", { name: workspace.ownerName })}
                </p>
              </div>
              {isCurrent ? (
                <span className="shrink-0 rounded-full bg-surface-secondary px-2 py-1 text-xs text-accent">
                  {t("Current")}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full bg-surface-secondary px-2 py-1">
                {t(workspace.role)}
              </span>
              <span className="rounded-full bg-surface-secondary px-2 py-1">
                {workspace.status === "archived" ? t("Archived") : t("Active")}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-4">
          <Button
            size="sm"
            variant={isCurrent ? "secondary" : "primary"}
            onPress={() => openWorkspace(workspace.id)}
          >
            <ExternalLink className="size-4" />
            {t("Open")}
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canEdit ? (
              <Button size="sm" variant="tertiary" onPress={() => openEdit(workspace)}>
                <Pencil className="size-4" />
                {t("Edit workspace")}
              </Button>
            ) : null}
            {workspace.isOwned && workspace.status === "active" ? (
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => setConfirmation({ kind: "archive", workspace })}
              >
                <Archive className="size-4" />
                {t("Archive")}
              </Button>
            ) : null}
            {workspace.isOwned && workspace.status === "archived" ? (
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => setConfirmation({ kind: "restore", workspace })}
              >
                <ArchiveRestore className="size-4" />
                {t("Restore")}
              </Button>
            ) : null}
            {!workspace.isOwned ? (
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => setConfirmation({ kind: "leave", workspace })}
              >
                {t("Leave")}
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Workspaces")}
        description={t("Create focused spaces for your work or open one shared with you.")}
        actions={
          <Button onPress={openCreate}>
            <Plus className="size-4" />
            {t("New workspace")}
          </Button>
        }
      />

      {pageError ? (
        <FormAlert title={t("Workspace action unavailable")} description={pageError} />
      ) : null}

      {owned.length > 0 ? (
        <section aria-labelledby="owned-workspaces-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="owned-workspaces-heading" className="font-medium text-foreground">
                {t("Your workspaces")}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {t("Up to 5 workspaces created by you, including archived ones.")}
              </p>
            </div>
            <span className="text-sm tabular-nums text-muted">{owned.length}/5</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">{owned.map(renderWorkspace)}</div>
        </section>
      ) : null}

      {shared.length > 0 ? (
        <section aria-labelledby="shared-workspaces-heading" className="space-y-3">
          <div>
            <h2 id="shared-workspaces-heading" className="font-medium text-foreground">
              {t("Shared with you")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t("Workspaces where you collaborate with another owner.")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">{shared.map(renderWorkspace)}</div>
        </section>
      ) : null}

      {owned.length === 0 && shared.length === 0 ? (
        <EmptyBlock
          icon={<Layers3 className="size-5" />}
          title={t("No workspaces yet")}
          description={t("Create a workspace to keep your projects, clients and time separate.")}
          action={<Button onPress={openCreate}>{t("New workspace")}</Button>}
        />
      ) : null}

      <WorkspaceFormModal
        isOpen={createOpen}
        title={t("New workspace")}
        name={name}
        logoDataUrl={logoDataUrl}
        errorMessage={formError}
        inputRef={logoInputRef}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
        onNameChange={setName}
        onLogoChange={handleLogo}
        onRemoveLogo={() => setLogoDataUrl(null)}
        onSubmit={submitCreate}
        submitLabel={t("Create workspace")}
      />

      <WorkspaceFormModal
        isOpen={Boolean(editWorkspace)}
        title={t("Edit workspace")}
        name={name}
        logoDataUrl={logoDataUrl}
        errorMessage={formError}
        inputRef={logoInputRef}
        onOpenChange={(open) => {
          if (!open) {
            setEditWorkspace(null);
            resetForm();
          }
        }}
        onNameChange={setName}
        onLogoChange={handleLogo}
        onRemoveLogo={() => setLogoDataUrl(null)}
        onSubmit={submitEdit}
        submitLabel={t("Save changes")}
        workspaceSettings={{ defaultBillable, weekStart }}
        onDefaultBillableChange={setDefaultBillable}
        onWeekStartChange={setWeekStart}
      />

      <Modal isOpen={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}>
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {confirmation?.kind === "archive"
                    ? t("Archive workspace?")
                    : confirmation?.kind === "restore"
                      ? t("Restore workspace?")
                      : t("Leave workspace?")}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  {confirmation?.kind === "archive"
                    ? t("Archived workspaces become read-only until the Owner restores them.")
                    : confirmation?.kind === "restore"
                      ? t("This workspace will become available for tracking again.")
                      : t(
                          "You will lose access to this workspace. Your tracked history stays intact.",
                        )}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={() => setConfirmation(null)}>
                  {t("Cancel")}
                </Button>
                <Button
                  variant={
                    confirmation?.kind === "archive" || confirmation?.kind === "leave"
                      ? "danger"
                      : "primary"
                  }
                  onPress={confirmWorkspaceAction}
                >
                  {confirmation?.kind === "archive"
                    ? t("Archive")
                    : confirmation?.kind === "restore"
                      ? t("Restore")
                      : t("Leave")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={switchOpen} onOpenChange={setSwitchOpen}>
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("Pause timer before switching?")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  {t(
                    "Pause the active timer before opening another workspace. It will remain paused in its original workspace.",
                  )}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={() => setSwitchOpen(false)}>
                  {t("Cancel")}
                </Button>
                <Button onPress={confirmSwitch}>{t("Pause and switch")}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

function WorkspaceFormModal({
  isOpen,
  title,
  name,
  logoDataUrl,
  errorMessage,
  inputRef,
  onOpenChange,
  onNameChange,
  onLogoChange,
  onRemoveLogo,
  onSubmit,
  submitLabel,
  workspaceSettings,
  onDefaultBillableChange,
  onWeekStartChange,
}: {
  isOpen: boolean;
  title: string;
  name: string;
  logoDataUrl: string | null;
  errorMessage: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onLogoChange: (file: File | undefined) => void;
  onRemoveLogo: () => void;
  onSubmit: () => void;
  submitLabel: string;
  workspaceSettings?: {
    defaultBillable: boolean;
    weekStart: "monday" | "sunday";
  };
  onDefaultBillableChange?: (value: boolean) => void;
  onWeekStartChange?: (value: "monday" | "sunday") => void;
}) {
  const { t } = useI18n();
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalTriggerRegistration />
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
              className="min-h-0"
            >
              <Modal.Body className="space-y-5">
                {errorMessage ? (
                  <FormAlert title={t("Could not save workspace")} description={errorMessage} />
                ) : null}
                <TextField
                  isRequired
                  fullWidth
                  name="workspace-name"
                  value={name}
                  validate={(value) => (value.trim() ? null : t("Workspace name is required"))}
                  onChange={onNameChange}
                >
                  <Label>{t("Name")}</Label>
                  <Input placeholder={t("Workspace name")} />
                  <FieldError />
                </TextField>
                <div className="space-y-2">
                  <Label>{t("Workspace logo")}</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar size="lg" aria-label={t("Workspace logo preview")}>
                      {logoDataUrl ? <Avatar.Image alt="" src={logoDataUrl} /> : null}
                      <Avatar.Fallback>
                        {initialsForWorkspace(name || t("Workspace"))}
                      </Avatar.Fallback>
                    </Avatar>
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          onLogoChange(file);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onPress={() => inputRef.current?.click()}
                      >
                        <Upload className="size-4" />
                        {t("Upload logo")}
                      </Button>
                      {logoDataUrl ? (
                        <Button type="button" size="sm" variant="tertiary" onPress={onRemoveLogo}>
                          {t("Remove")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <Description>
                    {t("PNG, JPG or WebP up to 500 KB. Used in report PDFs.")}
                  </Description>
                </div>
                {workspaceSettings ? (
                  <div className="space-y-5 border-t border-separator pt-5">
                    <div>
                      <h2 className="font-medium text-foreground">{t("Workspace settings")}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {t("Defaults shared by everyone in the workspace.")}
                      </p>
                    </div>
                    <Switch
                      aria-label={t("Billable by default")}
                      isSelected={workspaceSettings.defaultBillable}
                      onChange={(selected: boolean) => onDefaultBillableChange?.(selected)}
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Content>
                        <Label>{t("Billable by default")}</Label>
                        <Description>{t("New entries start marked as billable.")}</Description>
                      </Switch.Content>
                    </Switch>
                    <div className="flex flex-col gap-2">
                      <Label>{t("Week starts on")}</Label>
                      <Select
                        aria-label={t("Week starts on")}
                        value={workspaceSettings.weekStart}
                        onChange={(key) =>
                          onWeekStartChange?.(String(key ?? "monday") as "monday" | "sunday")
                        }
                      >
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {(["monday", "sunday"] as const).map((day) => (
                              <ListBox.Item
                                key={day}
                                id={day}
                                textValue={t(day === "monday" ? "Monday" : "Sunday")}
                              >
                                <Label>{t(day === "monday" ? "Monday" : "Sunday")}</Label>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="button" variant="tertiary" onPress={() => onOpenChange(false)}>
                  {t("Cancel")}
                </Button>
                <Button type="submit" isDisabled={!name.trim()}>
                  {submitLabel}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
