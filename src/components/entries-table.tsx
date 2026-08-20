import { Button, Chip, Modal, Table, toast } from "@heroui/react";
import { CircleDollarSign, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionDropdown } from "@/components/action-dropdown";
import { LogTimeModal } from "@/components/log-time-modal";
import { useStore } from "@/lib/store";
import { formatDate, formatDuration, getEntryEndDayOffset } from "@/lib/format";
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
  const { projects, members, deleteEntry, restoreEntry, updateEntry } = useStore();
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TimeEntry | null>(null);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const deletedEntry = pendingDelete;
    deleteEntry(deletedEntry.id);
    setPendingDelete(null);
    toast("Time entry deleted", {
      description: `${deletedEntry.task} · ${formatDuration(deletedEntry.seconds)}`,
      timeout: 20_000,
      actionProps: {
        children: "Undo",
        onPress: () => {
          const result = restoreEntry(deletedEntry);
          if (!result.success) toast("Could not restore entry", { description: result.error });
        },
      },
    });
  };

  const projectName = (id: string | null) =>
    id === null ? "No project" : (projects.find((p) => p.id === id)?.name ?? "Unknown project");
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "—";

  return (
    <>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Time entries" className="min-w-[720px]">
            <Table.Header>
              <Table.Column isRowHeader>Task</Table.Column>
              <Table.Column>Project</Table.Column>
              {showMember ? <Table.Column>Member</Table.Column> : null}
              {showDate ? <Table.Column>Date</Table.Column> : null}
              <Table.Column>Time</Table.Column>
              <Table.Column>Duration</Table.Column>
              <Table.Column>Billable</Table.Column>
              <Table.Column aria-label="Actions">{""}</Table.Column>
            </Table.Header>
            <Table.Body>
              {entries.map((entry) => (
                <Table.Row key={entry.id}>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{entry.task}</span>
                      {entry.description ? (
                        <span className="text-xs text-muted">{entry.description}</span>
                      ) : null}
                    </div>
                  </Table.Cell>
                  <Table.Cell>{projectName(entry.projectId)}</Table.Cell>
                  {showMember ? <Table.Cell>{memberName(entry.userId)}</Table.Cell> : null}
                  {showDate ? <Table.Cell>{formatDate(entry.date)}</Table.Cell> : null}
                  <Table.Cell className="tabular-nums text-muted">
                    {entry.start} – {entry.end}
                    {getEntryEndDayOffset(entry) > 0 ? (
                      <sup className="ml-1 text-[10px]">+{getEntryEndDayOffset(entry)}</sup>
                    ) : null}
                  </Table.Cell>
                  <Table.Cell className="tabular-nums font-medium">
                    {formatDuration(entry.seconds)}
                  </Table.Cell>
                  <Table.Cell>
                    <Chip color={entry.billable ? "success" : "default"} size="sm" variant="soft">
                      {entry.billable ? "Billable" : "Internal"}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-1">
                      <ActionDropdown
                        ariaLabel="Entry actions"
                        items={[
                          { id: "edit", label: "Edit entry", icon: <Pencil className="size-4" /> },
                          {
                            id: "billable",
                            label: entry.billable ? "Mark as internal" : "Mark as billable",
                            icon: <CircleDollarSign className="size-4" />,
                          },
                          {
                            id: "delete",
                            label: "Delete entry",
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
                      <Button
                        isIconOnly
                        aria-label="Delete entry"
                        size="sm"
                        variant="tertiary"
                        onPress={() => setPendingDelete(entry)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
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
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Delete time entry?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  This removes {pendingDelete?.task ?? "this entry"}. You can undo it from the
                  confirmation toast for 20 seconds.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Cancel
                </Button>
                <Button variant="danger" onPress={confirmDelete}>
                  Delete entry
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
