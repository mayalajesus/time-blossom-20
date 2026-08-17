import { Button, Chip, Input, Label, ListBox, Select } from "@heroui/react";
import { Pause, Play, Square } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { formatClock } from "@/lib/format";

export function TimerCard() {
  const { timer, elapsed, projects, startTimer, pauseTimer, resumeTimer, stopTimer } = useStore();
  const [task, setTask] = useState("");
  const [projectId, setProjectId] = useState<string>("p1");
  const active = timer.status !== "idle";
  const activeProject = projects.find((p) => p.id === timer.projectId);

  return (
    <div className="rounded-2xl border border-default bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="timer-task">What are you working on?</Label>
          <Input
            fullWidth
            id="timer-task"
            placeholder="Describe your task"
            value={active ? timer.task : task}
            disabled={active}
            onChange={(e) => setTask(e.target.value)}
          />
        </div>

        <div className="w-full space-y-2 lg:w-56">
          <Label>Project</Label>
          {active ? (
            <div className="flex h-10 items-center rounded-xl border border-default px-3 text-sm text-foreground">
              {activeProject?.name ?? "—"}
            </div>
          ) : (
            <Select
              aria-label="Project"
              fullWidth
              value={projectId}
              onChange={(key) => setProjectId(String(key ?? "p1"))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
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

        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
          <span className="shrink-0 font-mono text-2xl tabular-nums text-foreground sm:text-3xl">
            {formatClock(elapsed)}
          </span>
          {timer.status === "idle" ? (
            <Button onPress={() => startTimer(task, projectId)}>
              <Play className="size-4" />
              Start
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {timer.status === "running" ? (
                <Button variant="secondary" onPress={pauseTimer}>
                  <Pause className="size-4" />
                  Pause
                </Button>
              ) : (
                <Button variant="secondary" onPress={resumeTimer}>
                  <Play className="size-4" />
                  Resume
                </Button>
              )}
              <Button
                onPress={() => {
                  stopTimer();
                  setTask("");
                }}
              >
                <Square className="size-4" />
                Stop
              </Button>
            </div>
          )}
        </div>
      </div>

      {active ? (
        <div className="mt-4 flex items-center gap-2">
          <Chip color={timer.status === "running" ? "success" : "warning"} size="sm" variant="soft">
            {timer.status === "running" ? "Recording" : "Paused"}
          </Chip>
          <span className="text-xs text-muted">Started at {timer.startClock}</span>
        </div>
      ) : null}
    </div>
  );
}
