import { Button, Chip, Input, Label, TextField } from "@heroui/react";
import { Pause, Play, Square } from "lucide-react";
import { useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { ProjectSelect } from "@/components/project-select";
import { useStore } from "@/lib/store";
import { formatClock } from "@/lib/format";

export function TimerCard() {
  const { timer, elapsed, projects, startTimer, pauseTimer, resumeTimer, stopTimer } = useStore();
  const [task, setTask] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [timerError, setTimerError] = useState<string | null>(null);
  const active = timer.status !== "idle";
  const activeProject = projects.find((p) => p.id === timer.projectId);
  const projectLabel = activeProject?.name ?? "No project";

  return (
    <div className="rounded-xl border border-default bg-surface px-3 py-3 sm:px-4">
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,14rem)_auto_auto] lg:items-end">
        <TextField
          className="min-w-0"
          fullWidth
          name="timer-task"
          value={active ? timer.task : task}
          isReadOnly={active}
          onChange={setTask}
        >
          <Label className="sr-only">What are you working on?</Label>
          <Input placeholder="What are you working on?" />
        </TextField>

        <div className="min-w-0">
          <Label className="sr-only">Project</Label>
          {active ? (
            <Input
              fullWidth
              aria-label={`Project: ${projectLabel}`}
              readOnly
              value={projectLabel}
            />
          ) : (
            <ProjectSelect
              ariaLabel="Project"
              value={projectId ?? "none"}
              onChange={(value) => setProjectId(value === "none" || value === "all" ? null : value)}
            />
          )}
        </div>

        <span className="justify-self-start font-mono text-2xl tabular-nums text-foreground lg:justify-self-end">
          {formatClock(elapsed)}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
          {timer.status === "idle" ? (
            <Button
              className="w-full sm:w-auto"
              onPress={() => {
                const result = startTimer(task, projectId);
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
                }}
              >
                <Square className="size-4" />
                Stop
              </Button>
            </>
          )}
        </div>
      </div>

      {timerError ? (
        <div className="mt-3">
          <FormAlert title="Timer could not start" description={timerError} />
        </div>
      ) : null}

      {active ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-default pt-3">
          <Chip color={timer.status === "running" ? "success" : "warning"} size="sm" variant="soft">
            {timer.status === "running" ? "Recording" : "Paused"}
          </Chip>
          <span className="text-xs text-muted">Started at {timer.startClock}</span>
        </div>
      ) : null}
    </div>
  );
}
