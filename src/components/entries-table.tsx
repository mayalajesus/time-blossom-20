import { Button, Chip, Modal, Table, toast } from "@heroui/react";
import { CircleDollarSign, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionDropdown } from "@/components/action-dropdown";
import { DataTable } from "@/components/data-table";
import { LogTimeModal } from "@/components/log-time-modal";
import { ModalTriggerRegistration } from "@/components/overlay-trigger-registration";
import { useStore } from "@/lib/store";
import { formatDate, formatDuration, getEntryEndDayOffset } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { TimeEntry } from "@/lib/mock-data";

export function EntriesTable({
  entries,
  showDate = false,
  showMember = false,
}: {
  entries: TimeEntry[];
  showDate?: boolean;
  showMember?: boolean;
}) {
  const { projects, members, currentUserId, deleteEntry, restoreEntry, updateEntry } = useStore();
  const { locale, t, error } = useI18n();
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TimeEntry | null>(null);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const deletedEntry = pendingDelete;
    deleteEntry(deletedEntry.id);
    setPendingDelete(null);
    toast(t("Time entry deleted"), {
      description: `${deletedEntry.task} · ${formatDuration(deletedEntry.seconds, locale)}`,
      timeout: 20_000,
      actionProps: {
        children: t("Undo"),
        onPress: () => {
          const result = restoreEntry(deletedEntry);
          if (!result.success)
            toast(t("Could not restore entry"), { description: error(result.error) });
        },
      },
    });
  };

  const projectName = (id: string | null) =>
    id === null
      ? t("No project")
      : (projects.find((p) => p.id === id)?.name ?? t("Unknown project"));
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "—";

  return (
    <>
      <DataTable label={t("Time entries")} minWidth="min-w-[720px]">
        <Table.Header>
          <Table.Column isRowHeader>{t("Task")}</Table.Column>
          <Table.Column>{t("Project")}</Table.Column>
          {showMember ? <Table.Column>{t("Member")}</Table.Column> : null}
          {showDate ? <Table.Column>{t("Date")}</Table.Column> : null}
          <Table.Column>{t("Time")}</Table.Column>
          <Table.Column>{t("Duration")}</Table.Column>
          <Table.Column>{t("Billable")}</Table.Column>
          <Table.Column aria-label={t("Actions")}>{""}</Table.Column>
        </Table.Header>
        <Table.Body>
          {entries.map((entry) => {
            const isOwnEntry = entry.userId === currentUserId;
            return (
              <Table.Row key={entry.id}>
                <Table.Cell>
                  <div className="flex flex-col">
                    <span>{entry.task}</span>
                    {entry.description ? <span>{entry.description}</span> : null}
                  </div>
                </Table.Cell>
                <Table.Cell>{projectName(entry.projectId)}</Table.Cell>
                {showMember ? <Table.Cell>{memberName(entry.userId)}</Table.Cell> : null}
                {showDate ? <Table.Cell>{formatDate(entry.date, locale)}</Table.Cell> : null}
                <Table.Cell>
                  {entry.start} – {entry.end}
                  {getEntryEndDayOffset(entry) > 0 ? (
                    <sup className="ml-1">+{getEntryEndDayOffset(entry)}</sup>
                  ) : null}
                </Table.Cell>
                <Table.Cell>{formatDuration(entry.seconds, locale)}</Table.Cell>
                <Table.Cell>
                  <Chip color={entry.billable ? "success" : "default"} size="sm" variant="soft">
                    {entry.billable ? t("Billable") : t("Internal")}
                  </Chip>
                </Table.Cell>
                <Table.Cell>
                  {isOwnEntry ? (
                    <div className="flex justify-end gap-1">
                      <ActionDropdown
                        ariaLabel={t("Entry actions")}
                        items={[
                          {
                            id: "edit",
                            label: t("Edit entry"),
                            icon: <Pencil className="size-4" />,
                          },
                          {
                            id: "billable",
                            label: entry.billable ? t("Mark as internal") : t("Mark as billable"),
                            icon: <CircleDollarSign className="size-4" />,
                          },
                          {
                            id: "delete",
                            label: t("Delete entry"),
                            icon: <Trash2 className="size-4" />,
                            tone: "danger",
                          },
                        ]}
                        onAction={(key) => {
                          if (key === "billable") {
                            updateEntry(entry.id, { billable: !entry.billable });
                          }
                          if (key === "edit") setEditingEntry(entry);
                          if (key === "delete") setPendingDelete(entry);
                        }}
                      />
                    </div>
                  ) : null}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </DataTable>
      <LogTimeModal
        entry={editingEntry}
        isOpen={editingEntry !== null}
        onOpenChange={(open) => {
          if (!open) setEditingEntry(null);
        }}
      />
      <Modal
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("Delete time entry?")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>
                  {t(
                    "This removes {task}. You can undo it from the confirmation toast for 20 seconds.",
                    {
                      task: pendingDelete?.task ?? t("this entry"),
                    },
                  )}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t("Cancel")}
                </Button>
                <Button variant="danger" onPress={confirmDelete}>
                  {t("Delete entry")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
