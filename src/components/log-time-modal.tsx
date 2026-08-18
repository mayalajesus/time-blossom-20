import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Switch,
  TextArea,
  toast,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { HeroUIDatePicker } from "@/components/hero-ui-date-picker";
import { useStore, type StoreResult } from "@/lib/store";
import { isValidDateOnly, minutesBetween } from "@/lib/format";
import type { TimeEntry } from "@/lib/mock-data";

export function LogTimeModal({
  isOpen,
  onOpenChange,
  entry = null,
  initialDate,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: TimeEntry | null;
  initialDate?: string;
}) {
  const { projects, clients, addEntry, updateEntry, today, currentUserId } = useStore();
  const [task, setTask] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setTask(entry?.task ?? "");
    setProjectId(entry?.projectId ?? null);
    setDate(entry?.date ?? initialDate ?? today);
    setStart(entry?.start ?? "09:00");
    setEnd(entry?.end ?? "10:00");
    setDescription(entry?.description ?? "");
    setBillable(entry?.billable ?? true);
  }, [entry, initialDate, isOpen, today]);

  const minutes = minutesBetween(start, end);
  const invalid = task.trim().length === 0 || !isValidDateOnly(date) || minutes <= 0;

  const submit = () => {
    if (invalid) return;
    const cleanDescription = description.trim();
    let result: StoreResult;
    if (entry) {
      result = updateEntry(entry.id, {
        date,
        start,
        end,
        seconds: minutes * 60,
        projectId,
        task: task.trim(),
        description: cleanDescription,
        billable,
      });
    } else {
      result = addEntry({
        date,
        start,
        end,
        seconds: minutes * 60,
        userId: currentUserId,
        projectId,
        task: task.trim(),
        ...(cleanDescription ? { description: cleanDescription } : {}),
        billable,
      });
    }
    if (!result.success) {
      toast("Could not save entry", { description: result.error });
      return;
    }
    toast(entry ? "Time entry updated" : "Time entry added", {
      description: `${task.trim()} · ${minutes} min`,
    });
    setTask("");
    setDescription("");
    onOpenChange(false);
  };

  const availableProjects = projects.filter(
    (project) => project.status !== "archived" || project.id === entry?.projectId,
  );
  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedClient = selectedProject
    ? clients.find((client) => client.id === selectedProject.clientId)
    : null;

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{entry ? "Edit time entry" : "Log time manually"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="log-task">Task</Label>
                <Input
                  fullWidth
                  id="log-task"
                  placeholder="e.g. Landing page revisions"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <HeroUIDatePicker value={date} label="Date" onChange={setDate} />
                </div>
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    aria-label="Project"
                    fullWidth
                    value={projectId ?? "none"}
                    onChange={(key) => {
                      const value = String(key ?? "none");
                      setProjectId(value === "none" ? null : value);
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="none" textValue="No project">
                          <Label>No project</Label>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        {availableProjects.map((p) => (
                          <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                            <div className="flex min-w-0 flex-col">
                              <Label>{p.name}</Label>
                              <span className="text-xs text-muted">
                                {clients.find((client) => client.id === p.clientId)?.name ??
                                  "Unknown client"}
                              </span>
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>

              <p className="-mt-2 text-xs text-muted">
                {selectedProject
                  ? `Client: ${selectedClient?.name ?? "Unknown client"}`
                  : "No project · no client"}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="log-start">Start</Label>
                  <Input
                    fullWidth
                    id="log-start"
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="log-end">End</Label>
                  <Input
                    fullWidth
                    id="log-end"
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="log-notes">Notes</Label>
                <TextArea
                  fullWidth
                  id="log-notes"
                  placeholder="Optional details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <Switch isSelected={billable} onChange={(selected: boolean) => setBillable(selected)}>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  <Label>Billable</Label>
                </Switch.Content>
              </Switch>

              <p className="text-xs text-muted">
                Duration: {minutes > 0 ? `${minutes} minutes` : "invalid range"}
                {!isValidDateOnly(date) ? " · Choose a valid date" : ""}
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button isDisabled={invalid} onPress={submit}>
                Save entry
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
