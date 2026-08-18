import { Button, Chip, Dropdown, Label, Table } from "@heroui/react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { LogTimeModal } from "@/components/log-time-modal";
import { useStore } from "@/lib/store";
import { formatDate, formatDuration } from "@/lib/format";
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
  const { projects, members, deleteEntry, updateEntry } = useStore();
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

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
                      <Dropdown>
                        <Dropdown.Trigger
                          aria-label="Entry actions"
                          className="h-8 w-8 min-w-8 p-0"
                        >
                          <MoreHorizontal className="size-4" />
                        </Dropdown.Trigger>
                        <Dropdown.Popover>
                          <Dropdown.Menu
                            onAction={(key) => {
                              if (key === "billable") {
                                updateEntry(entry.id, { billable: !entry.billable });
                              }
                              if (key === "edit") setEditingEntry(entry);
                              if (key === "delete") deleteEntry(entry.id);
                            }}
                          >
                            <Dropdown.Item id="edit">
                              <Label>Edit entry</Label>
                            </Dropdown.Item>
                            <Dropdown.Item id="billable">
                              <Label>
                                {entry.billable ? "Mark as internal" : "Mark as billable"}
                              </Label>
                            </Dropdown.Item>
                            <Dropdown.Item id="delete">
                              <Label>Delete entry</Label>
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                      <Button
                        isIconOnly
                        aria-label="Delete entry"
                        size="sm"
                        variant="tertiary"
                        onPress={() => deleteEntry(entry.id)}
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
    </>
  );
}
