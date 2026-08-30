import {
  Card,
  Input,
  Label,
  Separator,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
} from "@heroui/react";
import { CircleDollar, Square } from "@gravity-ui/icons";
import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { ProjectSelect } from "@/components/project-select";
import { TimerActionButton } from "@/components/timer-action-button";
import { TimerDurationEditor } from "@/components/timer-duration-editor";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";

export function TrackerBar() {
  const {
    timer,
    elapsed,
    projects,
    settings,
    startTimer,
    updateTimer,
    setTimerElapsed,
    pauseTimer,
    resumeTimer,
    stopTimer,
  } = useStore();
  const { t, error } = useI18n();
  const [task, setTask] = useState("");
  const [activeTask, setActiveTask] = useState(timer.task);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [billable, setBillable] = useState(settings.defaultBillable);
  const [timerError, setTimerError] = useState<string | null>(null);
  const active = timer.status !== "idle";

  useEffect(() => {
    setActiveTask(active ? timer.task : "");
  }, [active, timer.task]);

  const updateActiveTimer = (patch: Parameters<typeof updateTimer>[0]) => {
    const result = updateTimer(patch);
    setTimerError(result.success ? null : result.error);
  };

  return (
    <div className="space-y-3" data-tracker-bar>
      <Card className="w-full gap-0 rounded-xl p-1.5" variant="default">
        <Toolbar
          aria-label={t("Timer")}
          data-status={timer.status}
          orientation="horizontal"
          className="grid-flow-row w-full max-w-full gap-1 grid-cols-1 sm:grid-flow-col sm:grid-cols-[minmax(0,1fr)_auto_minmax(11rem,15rem)_auto_auto_auto]"
        >
          <TextField
            className="min-w-0"
            fullWidth
            name="timer-task"
            value={active ? activeTask : task}
            onChange={(value) => {
              if (!active) {
                setTask(value);
                return;
              }
              setActiveTask(value);
              if (value.trim()) updateActiveTimer({ task: value });
            }}
          >
            <Label className="sr-only">{t("What are you working on?")}</Label>
            <Input
              placeholder={t("What are you working on?")}
              variant="secondary"
              onBlur={() => {
                if (!active) return;
                if (activeTask.trim()) {
                  updateActiveTimer({ task: activeTask });
                } else {
                  setActiveTask(timer.task);
                  setTimerError(t("A task is required."));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </TextField>

          <Separator orientation="vertical" className="hidden h-6 sm:block" />

          <div className="min-w-0">
            <Label className="sr-only">{t("Project")}</Label>
            <ProjectSelect
              ariaLabel={t("Project")}
              value={(active ? timer.projectId : projectId) ?? "none"}
              allowArchivedId={active ? timer.projectId : null}
              variant="secondary"
              onChange={(value) => {
                const nextProjectId = value === "none" || value === "all" ? null : value;
                if (active) {
                  updateActiveTimer({ projectId: nextProjectId });
                } else {
                  setProjectId(nextProjectId);
                  setBillable(
                    nextProjectId === null
                      ? settings.defaultBillable
                      : (projects.find((project) => project.id === nextProjectId)?.billable ??
                          settings.defaultBillable),
                  );
                }
              }}
            />
          </div>

          <Separator orientation="vertical" className="hidden h-6 sm:block" />

          <TimerDurationEditor
            elapsed={elapsed}
            isReadOnly={!active}
            onElapsedChange={(seconds) => {
              const result = setTimerElapsed(seconds);
              setTimerError(result.success ? null : result.error);
            }}
          />

          <Toolbar aria-label={t("Timer")} className="shrink-0 gap-1">
            <TimerActionButton
              status={timer.status}
              onPress={() => {
                if (timer.status === "idle") {
                  const result = startTimer(task, projectId, billable);
                  setTimerError(result.success ? null : result.error);
                  return;
                }

                if (timer.status === "running") pauseTimer();
                else resumeTimer();
              }}
            />

            {timer.status !== "idle" ? (
              <ToggleButtonGroup
                aria-label={t("Timer")}
                size="sm"
                className="shrink-0 gap-0.5"
                selectionMode="multiple"
              >
                <ToggleButton
                  aria-label={t("Stop")}
                  isIconOnly
                  isSelected={false}
                  className="rounded-lg"
                  onPress={() => {
                    stopTimer();
                    setTask("");
                    setActiveTask("");
                    setProjectId(null);
                  }}
                >
                  <Square aria-hidden="true" />
                </ToggleButton>
              </ToggleButtonGroup>
            ) : null}

            <Separator orientation="vertical" className="hidden h-6 sm:block" />

            <ToggleButtonGroup
              aria-label={t("Timer")}
              size="sm"
              className="shrink-0 gap-0.5"
              selectionMode="multiple"
            >
              <ToggleButton
                aria-label={t("Billable")}
                isIconOnly
                isSelected={active ? timer.billable : billable}
                className="rounded-lg"
                onChange={(selected: boolean) => {
                  if (active) updateActiveTimer({ billable: selected });
                  else setBillable(selected);
                }}
              >
                <CircleDollar aria-hidden="true" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Toolbar>
        </Toolbar>
      </Card>

      {timerError ? (
        <FormAlert title={t("Timer could not update")} description={error(timerError)} />
      ) : null}
    </div>
  );
}
