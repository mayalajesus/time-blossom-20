import { Button, Input, Label, Separator, TextField, ToggleButton, Toolbar } from "@heroui/react";
import { CircleDollarSign, Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { ProjectSelect } from "@/components/project-select";
import { formatClock } from "@/lib/format";
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
      <Toolbar
        aria-label={t("Timer")}
        data-status={timer.status}
        isAttached
        orientation="horizontal"
        className="grid-flow-row w-full max-w-full grid-cols-1 sm:grid-flow-col sm:grid-cols-[minmax(0,1fr)_auto_minmax(11rem,15rem)_auto_auto_auto]"
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

        <Separator orientation="vertical" className="hidden sm:block" />

        <div className="min-w-0">
          <Label className="sr-only">{t("Project")}</Label>
          <ProjectSelect
            ariaLabel={t("Project")}
            value={(active ? timer.projectId : projectId) ?? "none"}
            allowArchivedId={active ? timer.projectId : null}
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

        <span
          className="min-w-0 whitespace-nowrap text-left sm:text-right"
          aria-atomic="true"
          aria-live="polite"
          aria-label={`${t("Timer")}: ${formatClock(elapsed)}`}
        >
          {formatClock(elapsed)}
        </span>

        {timer.status === "idle" ? (
          <Button
            aria-label={t("Start")}
            isIconOnly
            className="size-9 min-w-9 shrink-0"
            size="sm"
            onPress={() => {
              const result = startTimer(task, projectId, billable);
              setTimerError(result.success ? null : result.error);
            }}
          >
            <Play aria-hidden="true" className="size-4" />
          </Button>
        ) : (
          <Button
            aria-label={timer.status === "running" ? t("Pause") : t("Resume")}
            isIconOnly
            className="size-9 min-w-9 shrink-0"
            size="sm"
            variant="secondary"
            onPress={timer.status === "running" ? pauseTimer : resumeTimer}
          >
            {timer.status === "running" ? (
              <Pause aria-hidden="true" className="size-4" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
          </Button>
        )}

        {timer.status !== "idle" ? (
          <Button
            aria-label={t("Stop")}
            isIconOnly
            className="size-9 min-w-9 shrink-0"
            size="sm"
            variant="tertiary"
            onPress={() => {
              stopTimer();
              setTask("");
              setActiveTask("");
              setProjectId(null);
            }}
          >
            <Square aria-hidden="true" className="size-4" />
          </Button>
        ) : null}

        <ToggleButton
          aria-label={t("Billable")}
          className="size-9 min-w-9 shrink-0"
          isIconOnly
          isSelected={active ? timer.billable : billable}
          size="md"
          variant="default"
          onChange={(selected: boolean) => {
            if (active) updateActiveTimer({ billable: selected });
            else setBillable(selected);
          }}
        >
          <CircleDollarSign aria-hidden="true" className="size-4" />
        </ToggleButton>
      </Toolbar>

      {timerError ? (
        <FormAlert title={t("Timer could not update")} description={error(timerError)} />
      ) : null}
    </div>
  );
}
