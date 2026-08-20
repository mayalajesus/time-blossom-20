import { Button, Input, Label, Switch, TextField } from "@heroui/react";
import { Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { ProjectSelect } from "@/components/project-select";
import { formatClock } from "@/lib/format";
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
    <div className="rounded-xl border border-default bg-surface p-3 sm:p-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(10rem,13rem)_auto_auto_auto] lg:items-center">
        <TextField
          className="min-w-0 sm:col-span-2 lg:col-span-1"
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
          <Label className="sr-only">What are you working on?</Label>
          <Input
            placeholder="What are you working on?"
            onBlur={() => {
              if (!active) return;
              if (activeTask.trim()) {
                updateActiveTimer({ task: activeTask });
              } else {
                setActiveTask(timer.task);
                setTimerError("A task is required.");
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </TextField>

        <div className="min-w-0 sm:col-span-1 lg:col-span-1">
          <Label className="sr-only">Project</Label>
          <ProjectSelect
            ariaLabel="Project"
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

        <span className="min-w-0 whitespace-nowrap font-mono text-2xl tabular-nums text-foreground sm:justify-self-end lg:col-span-1 lg:justify-self-end">
          {formatClock(elapsed)}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2 sm:justify-end lg:col-span-1 lg:flex-nowrap lg:justify-end">
          {timer.status === "idle" ? (
            <Button
              className="min-w-0 flex-1 sm:flex-none lg:shrink-0"
              size="sm"
              onPress={() => {
                const result = startTimer(task, projectId, billable);
                setTimerError(result.success ? null : result.error);
              }}
            >
              <Play className="size-4" />
              Start
            </Button>
          ) : (
            <>
              {timer.status === "running" ? (
                <Button
                  className="min-w-0 flex-1 sm:flex-none lg:shrink-0"
                  size="sm"
                  variant="secondary"
                  onPress={pauseTimer}
                >
                  <Pause className="size-4" />
                  Pause
                </Button>
              ) : (
                <Button
                  className="min-w-0 flex-1 sm:flex-none lg:shrink-0"
                  size="sm"
                  variant="secondary"
                  onPress={resumeTimer}
                >
                  <Play className="size-4" />
                  Resume
                </Button>
              )}
              <Button
                className="min-w-0 flex-1 sm:flex-none lg:shrink-0"
                size="sm"
                onPress={() => {
                  stopTimer();
                  setTask("");
                  setActiveTask("");
                  setProjectId(null);
                }}
              >
                <Square className="size-4" />
                Stop
              </Button>
            </>
          )}
        </div>

        <Switch
          className="min-w-0 shrink-0 sm:col-span-2 lg:col-span-1 lg:justify-self-end"
          isSelected={active ? timer.billable : billable}
          onChange={(selected: boolean) => {
            if (active) updateActiveTimer({ billable: selected });
            else setBillable(selected);
          }}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Content>
            <Label>Billable</Label>
          </Switch.Content>
        </Switch>
      </div>

      {timerError ? (
        <div className="mt-3">
          <FormAlert title="Timer could not update" description={timerError} />
        </div>
      ) : null}
    </div>
  );
}
