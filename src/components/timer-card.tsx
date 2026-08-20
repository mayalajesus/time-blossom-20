import { Button, Chip, Input, Label, Switch, TextField } from "@heroui/react";
import { Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { ProjectSelect } from "@/components/project-select";
import { formatClock } from "@/lib/format";
import { useStore } from "@/lib/store";

export function TimerCard() {
  const { timer, elapsed, settings, startTimer, updateTimer, pauseTimer, resumeTimer, stopTimer } =
    useStore();
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
    <div className="rounded-xl border border-default bg-surface px-3 py-3 sm:px-4">
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,14rem)_auto_auto] lg:items-end">
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

        <div className="min-w-0">
          <Label className="sr-only">Project</Label>
          <ProjectSelect
            ariaLabel="Project"
            value={(active ? timer.projectId : projectId) ?? "none"}
            allowArchivedId={active ? timer.projectId : null}
            onChange={(value) => {
              const nextProjectId = value === "none" || value === "all" ? null : value;
              if (active) updateActiveTimer({ projectId: nextProjectId });
              else setProjectId(nextProjectId);
            }}
          />
        </div>

        <span className="justify-self-start font-mono text-2xl tabular-nums text-foreground lg:justify-self-end">
          {formatClock(elapsed)}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
          {timer.status === "idle" ? (
            <Button
              className="w-full sm:w-auto"
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
                <Button className="w-full sm:w-auto" variant="secondary" onPress={pauseTimer}>
                  <Pause className="size-4" />
                  Pause
                </Button>
              ) : (
                <Button className="w-full sm:w-auto" variant="secondary" onPress={resumeTimer}>
                  <Play className="size-4" />
                  Resume
                </Button>
              )}
              <Button
                className="w-full sm:w-auto"
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
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-default pt-3">
        <Switch
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

        {active ? (
          <>
            <Chip
              color={timer.status === "running" ? "success" : "warning"}
              size="sm"
              variant="soft"
            >
              {timer.status === "running" ? "Recording" : "Paused"}
            </Chip>
            <span className="text-xs text-muted">Started at {timer.startClock}</span>
          </>
        ) : null}
      </div>

      {timerError ? (
        <div className="mt-3">
          <FormAlert title="Timer could not update" description={timerError} />
        </div>
      ) : null}
    </div>
  );
}
