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
import { useI18n } from "@/lib/i18n";
import { useStore, type StoreResult } from "@/lib/store";
import {
  addSecondsToDateTime,
  dateTimeToTimestamp,
  getDayOffset,
  formatDuration,
  formatDurationInput,
  getManualEntryDefaults,
  getElapsedMinutes,
  getEndDateForClockRange,
  getEndDateForEntry,
  isValidDateOnly,
  parseDurationInput,
  shiftDate,
} from "@/lib/format";
import type { TimeEntry } from "@/lib/mock-data";

export function LogTimeModal({
  isOpen,
  onOpenChange,
  entry = null,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: TimeEntry | null;
}) {
  const { projects, clients, settings, addEntry, updateEntry, currentUserId, timer } = useStore();
  const { locale, t, error } = useI18n();
  const [timeMode, setTimeMode] = useState<"range" | "duration">("range");
  const [task, setTask] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [date, setDate] = useState(() => getManualEntryDefaults().date);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [duration, setDuration] = useState("1:00");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const defaults = getManualEntryDefaults();
    setTask(entry?.task ?? "");
    setProjectId(entry?.projectId ?? null);
    setDate(entry?.date ?? defaults.date);
    setStart(entry?.start ?? defaults.start);
    setEnd(entry?.end ?? defaults.end);
    setDuration(formatDurationInput(entry?.seconds ?? 3600));
    setTimeMode(entry && entry.seconds % 60 !== 0 ? "duration" : "range");
    setDescription(entry?.description ?? "");
    setBillable(
      entry?.billable ??
        (entry?.projectId
          ? (projects.find((project) => project.id === entry.projectId)?.billable ??
            settings.defaultBillable)
          : settings.defaultBillable),
    );
    setSaveError(null);
  }, [entry, isOpen, projects, settings.defaultBillable]);

  const originalEndDate = entry ? getEndDateForEntry(entry) : undefined;
  const preserveOriginalRange = Boolean(entry && start === entry.start && end === entry.end);
  const endDate =
    entry && preserveOriginalRange && originalEndDate
      ? shiftDate(date, getDayOffset(entry.date, originalEndDate))
      : getEndDateForClockRange(date, start, end, originalEndDate);
  const parsedDurationSeconds = parseDurationInput(duration);
  const durationFinish =
    parsedDurationSeconds === null
      ? null
      : addSecondsToDateTime(date, start, parsedDurationSeconds);
  const effectiveEnd = timeMode === "duration" && durationFinish ? durationFinish.end : end;
  const effectiveEndDate =
    timeMode === "duration" && durationFinish ? durationFinish.endDate : endDate;
  const entrySeconds =
    timeMode === "duration"
      ? (parsedDurationSeconds ?? 0)
      : getElapsedMinutes(date, start, effectiveEndDate, effectiveEnd) * 60;
  const taskError = task.trim().length === 0 ? t("Task is required") : undefined;
  const dateError = !isValidDateOnly(date) ? t("Choose a valid date") : undefined;
  const timeError =
    timeMode === "duration"
      ? parsedDurationSeconds === null
        ? t("Use H:MM, HHMM, HMM, 2h or Ns (for example, 2:45, 825 or 45s)")
        : undefined
      : entrySeconds <= 0
        ? t("End time must be after start time")
        : undefined;
  const manualTimerError =
    !entry && timer.status !== "idle"
      ? t("Stop the active timer before adding time manually.")
      : undefined;
  const invalid = Boolean(taskError || dateError || timeError || manualTimerError);

  const submit = () => {
    if (invalid) return;
    const cleanDescription = description.trim();
    const startTimestamp = dateTimeToTimestamp(date, start);
    const timestampPatch =
      startTimestamp === null
        ? {}
        : {
            startTimestamp,
            endTimestamp: startTimestamp + entrySeconds * 1000,
          };
    let result: StoreResult;
    if (entry) {
      result = updateEntry(entry.id, {
        date,
        start,
        end: effectiveEnd,
        endDate: effectiveEndDate !== date ? effectiveEndDate : undefined,
        seconds: entrySeconds,
        projectId,
        task: task.trim(),
        description: cleanDescription,
        billable,
        ...timestampPatch,
      });
    } else {
      result = addEntry({
        date,
        start,
        end: effectiveEnd,
        endDate: effectiveEndDate !== date ? effectiveEndDate : undefined,
        seconds: entrySeconds,
        userId: currentUserId,
        projectId,
        task: task.trim(),
        ...(cleanDescription ? { description: cleanDescription } : {}),
        billable,
        ...timestampPatch,
      });
    }
    if (!result.success) {
      setSaveError(result.error);
      return;
    }
    toast(t(entry ? "Time entry updated" : "Time entry added"), {
      description: `${task.trim()} · ${formatDuration(entrySeconds, locale)}`,
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
          <Modal.Dialog className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col overflow-hidden">
            <Modal.CloseTrigger />
            <Modal.Header className="shrink-0">
              <Modal.Heading>{t(entry ? "Edit time entry" : "Log time manually")}</Modal.Heading>
            </Modal.Header>
            <Form
              className="flex min-h-0 flex-1 flex-col overflow-visible"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <Modal.Body className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain flex flex-col gap-4">
                {saveError ? (
                  <FormAlert title={t("Could not save entry")} description={error(saveError)} />
                ) : null}
                {manualTimerError ? (
                  <FormAlert
                    title={t("Manual entry unavailable")}
                    description={t(manualTimerError)}
                  />
                ) : null}

                <TextField
                  isRequired
                  fullWidth
                  name="task"
                  value={task}
                  validate={(value) => (value.trim() ? null : t("Task is required"))}
                  onChange={(value) => {
                    setTask(value);
                    setSaveError(null);
                  }}
                >
                  <Label>{t("Task")}</Label>
                  <Input placeholder={t("e.g. Landing page revisions")} />
                  <FieldError />
                </TextField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label>{t("Date")}</Label>
                    <HeroUIDatePicker
                      value={date}
                      label={t("Date")}
                      isInvalid={Boolean(dateError)}
                      onChange={(next) => {
                        setDate(next);
                        setSaveError(null);
                      }}
                    />
                    {dateError ? <FieldError>{dateError}</FieldError> : null}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Label>{t("Project")}</Label>
                    <ProjectSelect
                      ariaLabel={t("Project")}
                      value={projectId ?? "none"}
                      allowArchivedId={entry?.projectId ?? null}
                      onChange={(value) => {
                        const nextProjectId = value === "none" || value === "all" ? null : value;
                        setProjectId(nextProjectId);
                        if (!entry) {
                          setBillable(
                            nextProjectId === null
                              ? settings.defaultBillable
                              : (projects.find((project) => project.id === nextProjectId)
                                  ?.billable ?? settings.defaultBillable),
                          );
                        }
                        setSaveError(null);
                      }}
                    />
                  </div>
                </div>

                {selectedProject ? (
                  <Description>
                    {t("Client: {name}", { name: selectedClient?.name ?? t("Unknown client") })}
                  </Description>
                ) : null}

                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label={t("Time entry mode")}
                >
                  <Button
                    size="sm"
                    variant={timeMode === "range" ? "secondary" : "tertiary"}
                    onPress={() => setTimeMode("range")}
                  >
                    {t("Start / End")}
                  </Button>
                  <Button
                    size="sm"
                    variant={timeMode === "duration" ? "secondary" : "tertiary"}
                    onPress={() => setTimeMode("duration")}
                  >
                    {t("Duration")}
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField fullWidth name="start" type="time" value={start} onChange={setStart}>
                    <Label>{t("Start")}</Label>
                    <Input />
                  </TextField>
                  {timeMode === "range" ? (
                    <TextField
                      fullWidth
                      name="end"
                      type="time"
                      value={end}
                      isInvalid={Boolean(timeError)}
                      onChange={setEnd}
                    >
                      <Label>{t("End")}</Label>
                      <Input />
                      <FieldError>{timeError}</FieldError>
                    </TextField>
                  ) : (
                    <TextField
                      fullWidth
                      name="duration"
                      value={duration}
                      isInvalid={Boolean(timeError)}
                      onChange={setDuration}
                      validate={(value) =>
                        parseDurationInput(value) === null
                          ? t("Use H:MM, HHMM, HMM, 2h or Ns")
                          : null
                      }
                    >
                      <Label>{t("Duration")}</Label>
                      <Input placeholder={t("e.g. 2:45 or 825")} />
                      <FieldError />
                    </TextField>
                  )}
                </div>

                <Description>
                  {t("Duration: {value}", {
                    value:
                      entrySeconds > 0 ? formatDuration(entrySeconds, locale) : t("invalid range"),
                  })}
                </Description>

                <TextField
                  fullWidth
                  name="description"
                  value={description}
                  onChange={setDescription}
                >
                  <Label>{t("Notes")}</Label>
                  <TextArea placeholder={t("Optional details")} />
                  <Description>{t("Keep useful context attached to this entry.")}</Description>
                </TextField>

                <Switch
                  isSelected={billable}
                  onChange={(selected: boolean) => setBillable(selected)}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Content>
                    <Label>{t("Billable")}</Label>
                  </Switch.Content>
                </Switch>
              </Modal.Body>
              <Modal.Footer className="shrink-0">
                <Button slot="close" type="button" variant="secondary">
                  {t("Cancel")}
                </Button>
                <Button type="submit" isDisabled={invalid}>
                  {t("Save entry")}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
