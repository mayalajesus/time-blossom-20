import { Button, Description, Dropdown, Label, Modal, toast } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Layers3 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore, type WorkspaceSummary } from "@/lib/store";

function WorkspaceMark({
  workspace,
  compact = false,
}: {
  workspace: WorkspaceSummary;
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex ${compact ? "size-8" : "size-9"} shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-xs font-semibold text-accent`}
    >
      {workspace.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}

function WorkspaceItem({ workspace, active }: { workspace: WorkspaceSummary; active: boolean }) {
  const { t } = useI18n();
  return (
    <Dropdown.Item
      id={workspace.id}
      textValue={`${workspace.name} ${workspace.ownerName} ${workspace.role}`}
      {...(active ? { className: "bg-surface-secondary" } : {})}
    >
      <WorkspaceMark workspace={workspace} compact />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{workspace.name}</span>
          {workspace.status === "archived" ? (
            <span className="shrink-0 text-[0.65rem] text-muted">{t("Archived")}</span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted">
          {workspace.isOwned ? t("Owned by you") : workspace.ownerName} · {t(workspace.role)}
        </span>
      </span>
      {active ? <Check aria-hidden="true" className="size-4 shrink-0 text-accent" /> : null}
    </Dropdown.Item>
  );
}

export function WorkspaceSwitcher({
  collapsed = false,
  compact = false,
}: {
  collapsed?: boolean;
  compact?: boolean;
}) {
  const { workspaces, activeWorkspaceId, currentWorkspace, timer, switchWorkspace, pauseTimer } =
    useStore();
  const { t, error } = useI18n();
  const navigate = useNavigate();
  const [switchOpen, setSwitchOpen] = useState(false);
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null);

  if (!currentWorkspace) return null;
  const currentSummary = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  if (!currentSummary) return null;
  const own = workspaces.filter((workspace) => workspace.isOwned);
  const shared = workspaces.filter((workspace) => !workspace.isOwned);

  const showResult = (result: ReturnType<typeof switchWorkspace>) => {
    if (!result.success) toast(error(result.error));
  };

  const requestSwitch = (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) return;
    if (timer.status === "running") {
      setPendingWorkspaceId(workspaceId);
      setSwitchOpen(true);
      return;
    }
    const result = switchWorkspace(workspaceId);
    if (result.success) return;
    showResult(result);
  };

  const confirmSwitch = () => {
    if (!pendingWorkspaceId) return;
    pauseTimer();
    const result = switchWorkspace(pendingWorkspaceId);
    if (result.success) {
      setSwitchOpen(false);
      setPendingWorkspaceId(null);
      return;
    }
    showResult(result);
  };

  const pendingWorkspace = workspaces.find((workspace) => workspace.id === pendingWorkspaceId);

  return (
    <>
      <Dropdown>
        <Dropdown.Trigger
          aria-label={t("Switch workspace")}
          className={
            collapsed || compact
              ? "touch-target-compact flex h-10 w-10 min-w-10 items-center justify-center rounded-xl p-0"
              : "flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1.5 text-left ring-offset-2 focus-visible:ring-2 focus-visible:ring-focus"
          }
        >
          <WorkspaceMark workspace={currentSummary} compact={collapsed || compact} />
          {!collapsed && !compact ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{currentSummary.name}</span>
              <span className="block truncate text-xs text-muted">{t(currentSummary.role)}</span>
            </span>
          ) : null}
          {!collapsed && !compact ? (
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
          ) : null}
          {collapsed || compact ? <span className="sr-only">{currentSummary.name}</span> : null}
        </Dropdown.Trigger>
        <Dropdown.Popover
          placement={collapsed ? "right" : "bottom start"}
          className="w-72 max-w-[calc(100vw-1rem)] p-1"
        >
          <div className="px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
            {t("Switch workspace")}
          </div>
          <Dropdown.Menu onAction={(key) => requestSwitch(String(key))}>
            {own.length > 0 ? (
              <>
                <Dropdown.Item id="owned-heading" isDisabled textValue={t("Your workspaces")}>
                  <Label className="text-xs uppercase tracking-[0.1em] text-muted">
                    {t("Your workspaces")}
                  </Label>
                </Dropdown.Item>
                {own.map((workspace) => (
                  <WorkspaceItem
                    key={workspace.id}
                    workspace={workspace}
                    active={workspace.id === activeWorkspaceId}
                  />
                ))}
              </>
            ) : null}
            {shared.length > 0 ? (
              <>
                <Dropdown.Item id="shared-heading" isDisabled textValue={t("Shared with you")}>
                  <Label className="text-xs uppercase tracking-[0.1em] text-muted">
                    {t("Shared with you")}
                  </Label>
                </Dropdown.Item>
                {shared.map((workspace) => (
                  <WorkspaceItem
                    key={workspace.id}
                    workspace={workspace}
                    active={workspace.id === activeWorkspaceId}
                  />
                ))}
              </>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <Modal isOpen={switchOpen} onOpenChange={setSwitchOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("Pause timer before switching?")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-3">
                <p className="text-sm text-muted">
                  {t(
                    "Your active timer is running in {workspace}. Pause it before opening another workspace.",
                    {
                      workspace: pendingWorkspace?.name ?? t("workspace"),
                    },
                  )}
                </p>
                <div className="flex items-center gap-2 rounded-xl bg-surface-secondary p-3">
                  <Layers3 aria-hidden="true" className="size-4 text-accent" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{currentSummary.name}</p>
                    <Description>
                      {t("The timer will remain paused in its original workspace.")}
                    </Description>
                  </div>
                </div>
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
    </>
  );
}
