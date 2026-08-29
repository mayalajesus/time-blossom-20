import { Button, Card, Input, Label, TextField, ToggleButton } from "@heroui/react";
import { CircleDollarSign, Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { ProjectSelect } from "@/components/project-select";
import { formatClock } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";

export function TimerCard() {
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
    <Card className="p-2 sm:p-2.5">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)] lg:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)_auto] lg:items-center">
        <TextField
          className="min-w-0 sm:col-span-1 lg:col-span-1"
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

        <div className="min-w-0 sm:col-span-1 lg:col-span-1">
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

        <div className="flex min-w-0 items-center gap-2 sm:col-span-2 lg:col-span-1">
          <div className="flex min-w-0 items-center gap-2" data-status={timer.status}>
            <span
              aria-atomic="true"
              aria-live="polite"
              aria-label={`${t("Timer")}: ${formatClock(elapsed)}`}
            >
              {formatClock(elapsed)}
            </span>
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
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
              <>
                {timer.status === "running" ? (
                  <Button
                    aria-label={t("Pause")}
                    isIconOnly
                    className="size-9 min-w-9 shrink-0"
                    size="sm"
                    variant="secondary"
                    onPress={pauseTimer}
                  >
                    <Pause aria-hidden="true" className="size-4" />
                  </Button>
                ) : (
                  <Button
                    aria-label={t("Resume")}
                    isIconOnly
                    className="size-9 min-w-9 shrink-0"
                    size="sm"
                    variant="secondary"
                    onPress={resumeTimer}
                  >
                    <Play aria-hidden="true" className="size-4" />
                  </Button>
                )}
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
              </>
            )}
          </div>

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
        </div>
      </div>

      {timerError ? (
        <div className="mt-3">
          <FormAlert title={t("Timer could not update")} description={error(timerError)} />
        </div>
      ) : null}
    </Card>
  );
}
