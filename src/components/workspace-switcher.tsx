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
      aria-current={active ? "true" : undefined}
    >
      <span aria-hidden="true">
        <Layers3 className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{workspace.name}</span>
          {workspace.status === "archived" ? (
            <span className="shrink-0">{t("Archived")}</span>
          ) : null}
        </span>
        <span className="block truncate">
          {workspace.isOwned ? t("Owned by you") : workspace.ownerName} · {t(workspace.role)}
        </span>
      </span>
      {active ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
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
  const triggerContent = (
    <>
      <span aria-hidden="true">
        <Layers3 className="size-4" />
      </span>
      {!collapsed ? (
        <span className="min-w-0 flex-1">
          <span>{currentSummary.name}</span>
          <span>{t(currentSummary.role)}</span>
        </span>
      ) : null}
      {!collapsed ? <ChevronDown aria-hidden="true" className="size-4 shrink-0" /> : null}
      {collapsed ? <span className="sr-only">{currentSummary.name}</span> : null}
    </>
  );
  const workspaceMenu = (
    <Dropdown.Menu aria-label={t("Workspaces")} onAction={(key) => requestSwitch(String(key))}>
      {own.length > 0 ? (
        <Dropdown.Section aria-label={t("Your workspaces")}>
          <Dropdown.Item id="owned-heading" isDisabled textValue={t("Your workspaces")}>
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
        <Dropdown.Section aria-label={t("Shared with you")}>
          <Dropdown.Item id="shared-heading" isDisabled textValue={t("Shared with you")}>
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
      <Card variant="secondary" className="p-1">
        <Dropdown>
          <Dropdown.Trigger
            aria-label={t("Switch workspace")}
            className={
              collapsed
                ? "flex h-10 w-10 items-center justify-center p-0"
                : "flex min-w-0 items-center gap-2"
            }
          >
            {triggerContent}
          </Dropdown.Trigger>
          <Dropdown.Popover
            placement={
              collapsed ? "right" : popoverPlacement === "footer" ? "top start" : "bottom start"
            }
            shouldFlip
            containerPadding={12}
            offset={8}
            className="max-w-[calc(100vw-1rem)]"
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
                <p>
                  {t(
                    "Your active timer is running in {workspace}. Pause it before opening another workspace.",
                    {
                      workspace: pendingWorkspace?.name ?? t("workspace"),
                    },
                  )}
                </p>
                <div className="flex items-center gap-2 p-3">
                  <Layers3 aria-hidden="true" className="size-4" />
                  <div className="min-w-0">
                    <p className="truncate">{currentSummary.name}</p>
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
