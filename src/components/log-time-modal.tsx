import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  Switch,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { HeroUIDatePicker } from "@/components/hero-ui-date-picker";
import { ProjectSelect } from "@/components/project-select";
import { useStore, type StoreResult } from "@/lib/store";
import {
  getDayOffset,
  getElapsedMinutes,
  getEndDateForClockRange,
  getEndDateForEntry,
  isValidDateOnly,
  shiftDate,
} from "@/lib/format";
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
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTask(entry?.task ?? "");
    setProjectId(entry?.projectId ?? null);
    setDate(entry?.date ?? initialDate ?? today);
    setStart(entry?.start ?? "09:00");
    setEnd(entry?.end ?? "10:00");
    setDescription(entry?.description ?? "");
    setBillable(entry?.billable ?? true);
    setSaveError(null);
  }, [entry, initialDate, isOpen, today]);

  const originalEndDate = entry ? getEndDateForEntry(entry) : undefined;
  const preserveOriginalRange = Boolean(entry && start === entry.start && end === entry.end);
  const endDate =
    entry && preserveOriginalRange && originalEndDate
      ? shiftDate(date, getDayOffset(entry.date, originalEndDate))
      : getEndDateForClockRange(date, start, end, originalEndDate);
  const minutes = getElapsedMinutes(date, start, endDate, end);
  const taskError = task.trim().length === 0 ? "Task is required" : undefined;
  const dateError = !isValidDateOnly(date) ? "Choose a valid date" : undefined;
  const timeError = minutes <= 0 ? "End time must be after start time" : undefined;
  const invalid = Boolean(taskError || dateError || timeError);

  const submit = () => {
    if (invalid) return;
    const cleanDescription = description.trim();
    let result: StoreResult;
    if (entry) {
      result = updateEntry(entry.id, {
        date,
        start,
        end,
        endDate: endDate !== date ? endDate : undefined,
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
        endDate: endDate !== date ? endDate : undefined,
        seconds: minutes * 60,
        userId: currentUserId,
        projectId,
        task: task.trim(),
        ...(cleanDescription ? { description: cleanDescription } : {}),
        billable,
      });
    }
    if (!result.success) {
      setSaveError(result.error);
      return;
    }
    toast(entry ? "Time entry updated" : "Time entry added", {
      description: `${task.trim()} · ${minutes} min`,
    });
    setTask("");
    setDescription("");
    onOpenChange(false);
  };

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
            <Form
              className="flex flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <Modal.Body className="flex flex-col gap-4">
                {saveError ? (
                  <FormAlert title="Could not save entry" description={saveError} />
                ) : null}

                <TextField
                  isRequired
                  fullWidth
                  name="task"
                  value={task}
                  validate={(value) => (value.trim() ? null : "Task is required")}
                  onChange={(value) => {
                    setTask(value);
                    setSaveError(null);
                  }}
                >
                  <Label>Task</Label>
                  <Input placeholder="e.g. Landing page revisions" />
                  <FieldError />
                </TextField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label>Date</Label>
                    <HeroUIDatePicker
                      value={date}
                      label="Date"
                      isInvalid={Boolean(dateError)}
                      onChange={(next) => {
                        setDate(next);
                        setSaveError(null);
                      }}
                    />
                    {dateError ? <FieldError>{dateError}</FieldError> : null}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Label>Project</Label>
                    <ProjectSelect
                      ariaLabel="Project"
                      value={projectId ?? "none"}
                      allowArchivedId={entry?.projectId ?? null}
                      onChange={(value) => {
                        setProjectId(value === "none" || value === "all" ? null : value);
                        setSaveError(null);
                      }}
                    />
                  </div>
                </div>

                <Description>
                  {selectedProject
                    ? `Client: ${selectedClient?.name ?? "Unknown client"}`
                    : "No project · no client"}
                </Description>

                <div className="grid grid-cols-2 gap-4">
                  <TextField fullWidth name="start" type="time" value={start} onChange={setStart}>
                    <Label>Start</Label>
                    <Input />
                  </TextField>
                  <TextField
                    fullWidth
                    name="end"
                    type="time"
                    value={end}
                    isInvalid={Boolean(timeError)}
                    onChange={setEnd}
                  >
                    <Label>End</Label>
                    <Input />
                    <FieldError>{timeError}</FieldError>
                  </TextField>
                </div>

                <TextField
                  fullWidth
                  name="description"
                  value={description}
                  onChange={setDescription}
                >
                  <Label>Notes</Label>
                  <TextArea placeholder="Optional details" />
                  <Description>Keep useful context attached to this entry.</Description>
                </TextField>

                <Switch
                  isSelected={billable}
                  onChange={(selected: boolean) => setBillable(selected)}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Content>
                    <Label>Billable</Label>
                  </Switch.Content>
                </Switch>

                <Description>
                  Duration: {minutes > 0 ? `${minutes} minutes` : "invalid range"}
                </Description>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" type="button" variant="secondary">
                  Cancel
                </Button>
                <Button type="submit" isDisabled={invalid}>
                  Save entry
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
