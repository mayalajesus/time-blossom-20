import { Button, Card, Description, Dropdown, Label, Modal, toast } from "@heroui/react";
import { Check, ChevronDown, Layers3 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore, type WorkspaceSummary } from "@/lib/store";
import { ModalTriggerRegistration } from "@/components/overlay-trigger-registration";

function WorkspaceItem({ workspace, active }: { workspace: WorkspaceSummary; active: boolean }) {
  const { t } = useI18n();
  return (
    <Dropdown.Item
      id={workspace.id}
      textValue={`${workspace.name} ${workspace.ownerName} ${workspace.role}`}
      className={`workspace-switcher-item${active ? " workspace-switcher-item-active" : ""}`}
    >
      <span className="workspace-switcher-item-mark" aria-hidden="true">
        <Layers3 className="size-4" />
      </span>
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
      {active ? <Check aria-hidden="true" className="size-4 shrink-0 text-foreground" /> : null}
    </Dropdown.Item>
  );
}

export function WorkspaceSwitcher({
  collapsed = false,
  popoverPlacement = "bottom",
}: {
  collapsed?: boolean;
  popoverPlacement?: "bottom" | "footer";
}) {
  const { workspaces, activeWorkspaceId, currentWorkspace, timer, switchWorkspace, pauseTimer } =
    useStore();
  const { t, error } = useI18n();
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
  const triggerClassName = `workspace-switcher-trigger${collapsed ? " workspace-switcher-trigger-collapsed" : ""}`;
  const triggerContent = (
    <>
      <span className="workspace-switcher-mark" aria-hidden="true">
        <Layers3 className="size-4" />
      </span>
      {!collapsed ? (
        <span className="workspace-switcher-meta min-w-0 flex-1">
          <span className="workspace-switcher-name">{currentSummary.name}</span>
          <span className="workspace-switcher-role">{t(currentSummary.role)}</span>
        </span>
      ) : null}
      {!collapsed ? (
        <ChevronDown
          aria-hidden="true"
          className="workspace-switcher-chevron size-4 shrink-0 text-muted"
        />
      ) : null}
      {collapsed ? <span className="sr-only">{currentSummary.name}</span> : null}
    </>
  );
  const workspaceMenu = (
    <Dropdown.Menu aria-label={t("Workspaces")} onAction={(key) => requestSwitch(String(key))}>
      {own.length > 0 ? (
        <Dropdown.Section aria-label={t("Your workspaces")} className="workspace-switcher-section">
          <Dropdown.Item
            id="owned-heading"
            isDisabled
            textValue={t("Your workspaces")}
            className="workspace-switcher-group-heading"
          >
            <Label>{t("Your workspaces")}</Label>
          </Dropdown.Item>
          {own.map((workspace) => (
            <WorkspaceItem
              key={workspace.id}
              workspace={workspace}
              active={workspace.id === activeWorkspaceId}
            />
          ))}
        </Dropdown.Section>
      ) : null}
      {shared.length > 0 ? (
        <Dropdown.Section aria-label={t("Shared with you")} className="workspace-switcher-section">
          <Dropdown.Item
            id="shared-heading"
            isDisabled
            textValue={t("Shared with you")}
            className="workspace-switcher-group-heading"
          >
            <Label>{t("Shared with you")}</Label>
          </Dropdown.Item>
          {shared.map((workspace) => (
            <WorkspaceItem
              key={workspace.id}
              workspace={workspace}
              active={workspace.id === activeWorkspaceId}
            />
          ))}
        </Dropdown.Section>
      ) : null}
    </Dropdown.Menu>
  );

  return (
    <>
      <Card
        variant="secondary"
        className={`workspace-switcher-card${collapsed ? " workspace-switcher-card-collapsed" : ""}`}
      >
        <Dropdown>
          <Dropdown.Trigger aria-label={t("Switch workspace")} className={triggerClassName}>
            {triggerContent}
          </Dropdown.Trigger>
          <Dropdown.Popover
            placement={
              collapsed ? "right" : popoverPlacement === "footer" ? "top start" : "bottom start"
            }
            shouldFlip
            containerPadding={12}
            offset={8}
            className={`workspace-switcher-popover${collapsed ? " workspace-switcher-popover-collapsed" : ""}`}
          >
            {workspaceMenu}
          </Dropdown.Popover>
        </Dropdown>
      </Card>

      <Modal isOpen={switchOpen} onOpenChange={setSwitchOpen}>
        <ModalTriggerRegistration />
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
                  <Layers3 aria-hidden="true" className="size-4 text-muted" />
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
