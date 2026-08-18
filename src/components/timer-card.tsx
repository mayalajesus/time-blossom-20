import { Button, Chip, Input, Label, ListBox, Select } from "@heroui/react";
import { Pause, Play, Square } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { formatClock } from "@/lib/format";

export function TimerCard() {
  const { timer, elapsed, projects, startTimer, pauseTimer, resumeTimer, stopTimer } = useStore();
  const [task, setTask] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const active = timer.status !== "idle";
  const activeProject = projects.find((p) => p.id === timer.projectId);
  const projectLabel = activeProject?.name ?? "No project";

  return (
    <div className="rounded-xl border border-default bg-surface px-3 py-3 sm:px-4">
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,14rem)_auto_auto] lg:items-end">
        <div className="min-w-0">
          <Label className="sr-only" htmlFor="timer-task">
            What are you working on?
          </Label>
          <Input
            fullWidth
            id="timer-task"
            placeholder="What are you working on?"
            value={active ? timer.task : task}
            disabled={active}
            onChange={(e) => setTask(e.target.value)}
          />
        </div>

        <div className="min-w-0">
          <Label className="sr-only">Project</Label>
          {active ? (
            <div
              aria-label={`Project: ${projectLabel}`}
              className="flex h-10 min-w-0 items-center truncate rounded-xl border border-default px-3 text-sm text-foreground"
            >
              {projectLabel}
            </div>
          ) : (
            <Select
              aria-label="Project"
              fullWidth
              value={projectId ?? "none"}
              onChange={(key) => setProjectId(key === "none" || key === null ? null : String(key))}
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
                  {projects
                    .filter((p) => p.status !== "archived")
                    .map((p) => (
                      <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                        <Label>{p.name}</Label>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        </div>

        <span className="justify-self-start font-mono text-2xl tabular-nums text-foreground lg:justify-self-end">
          {formatClock(elapsed)}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
          {timer.status === "idle" ? (
            <Button className="w-full sm:w-auto" onPress={() => startTimer(task, projectId)}>
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
