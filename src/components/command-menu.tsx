import { Input, Kbd, Label, ListBox, Modal } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CalendarDays,
  FolderKanban,
  Play,
  Plug,
  Plus,
  Search,
  Settings,
  Sun,
  Timer,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";

interface Command {
  id: string;
  label: string;
  hint: string;
  group: "Navigation" | "Actions" | "Projects" | "Clients";
  icon: ReactNode;
  run: () => void;
}

export function CommandMenu({
  isOpen,
  onOpenChange,
  onLogTime,
  onToggleTheme,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLogTime: () => void;
  onToggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const { projects, clients, timer, startTimer, stopTimer } = useStore();
  const [query, setQuery] = useState("");

  const close = () => {
    setQuery("");
    onOpenChange(false);
  };

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      {
        id: "nav-tracker",
        label: "Tracker",
        hint: "Go to tracker",
        icon: <CalendarDays className="size-4" />,
        group: "Navigation",
        run: () => navigate({ to: "/today" }),
      },
      {
        id: "nav-timesheet",
        label: "Timesheet",
        hint: "All time entries",
        icon: <Timer className="size-4" />,
        group: "Navigation",
        run: () => navigate({ to: "/timesheet" }),
      },
      {
        id: "nav-projects",
        label: "Projects",
        hint: "Manage projects",
        icon: <FolderKanban className="size-4" />,
        group: "Navigation",
        run: () => navigate({ to: "/projects" }),
      },
      {
        id: "nav-clients",
        label: "Clients",
        hint: "Manage clients",
        icon: <Building2 className="size-4" />,
        group: "Navigation",
        run: () => navigate({ to: "/clients" }),
      },
      {
        id: "nav-team",
        label: "Team",
        hint: "Members and roles",
        icon: <Users className="size-4" />,
        group: "Navigation",
        run: () => navigate({ to: "/team" }),
      },
      {
        id: "nav-reports",
        label: "Reports",
        hint: "Time analytics",
        icon: <BarChart3 className="size-4" />,
        group: "Navigation",
        run: () => navigate({ to: "/reports" }),
      },
      {
        id: "nav-integrations",
        label: "Integrations",
        hint: "Trello and more",
        icon: <Plug className="size-4" />,
        group: "Navigation",
        run: () => navigate({ to: "/integrations" }),
      },
      {
        id: "nav-settings",
        label: "Settings",
        hint: "Workspace settings",
        icon: <Settings className="size-4" />,
        group: "Navigation",
        run: () => navigate({ to: "/settings" }),
      },
    ];

    const actions: Command[] = [
      {
        id: "action-timer",
        label: timer.status === "idle" ? "Start timer" : "Stop timer",
        hint: timer.status === "idle" ? "Begin tracking now" : "Save the running entry",
        icon: <Play className="size-4" />,
        group: "Actions",
        run: () => (timer.status === "idle" ? startTimer("Quick task", "p1") : stopTimer()),
      },
      {
        id: "action-log",
        label: "Log time manually",
        hint: "Add a past entry",
        icon: <Plus className="size-4" />,
        group: "Actions",
        run: onLogTime,
      },
      {
        id: "action-theme",
        label: "Toggle theme",
        hint: "Switch light and dark",
        icon: <Sun className="size-4" />,
        group: "Actions",
        run: onToggleTheme,
      },
      {
        id: "action-search",
        label: query ? `Search for "${query}"` : "Global search",
        hint: "Open search results",
        icon: <Search className="size-4" />,
        group: "Actions",
        run: () => navigate({ to: "/search", search: { q: query } }),
      },
    ];

    const projectCommands: Command[] = projects.map((p) => ({
      id: `project-${p.id}`,
      label: p.name,
      hint: "Open project",
      icon: <FolderKanban className="size-4" />,
      group: "Projects",
      run: () => navigate({ to: "/projects/$projectId", params: { projectId: p.id } }),
    }));

    const clientCommands: Command[] = clients.map((c) => ({
      id: `client-${c.id}`,
      label: c.name,
      hint: "Open clients",
      icon: <Building2 className="size-4" />,
      group: "Clients",
      run: () => navigate({ to: "/clients" }),
    }));

    return [...actions, ...nav, ...projectCommands, ...clientCommands];
  }, [
    clients,
    navigate,
    onLogTime,
    onToggleTheme,
    projects,
    query,
    startTimer,
    stopTimer,
    timer.status,
  ]);

  const filtered = commands.filter((c) =>
    `${c.label} ${c.group}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const groups: Command["group"][] = ["Actions", "Navigation", "Projects", "Clients"];

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) setQuery("");
        onOpenChange(open);
      }}
    >
      <Modal.Backdrop>
        <Modal.Container placement="top" size="sm">
          <Modal.Dialog>
            <div className="border-b border-default px-3 py-2">
              <Input
                fullWidth
                aria-label="Command menu search"
                autoFocus
                placeholder="Search commands, projects, clients…"
                value={query}
                variant="secondary"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  No results for “{query}”.
                </p>
              ) : (
                <ListBox
                  aria-label="Commands"
                  selectionMode="none"
                  onAction={(key) => {
                    const cmd = commands.find((c) => c.id === String(key));
                    close();
                    cmd?.run();
                  }}
                >
                  {groups
                    .filter((g) => filtered.some((c) => c.group === g))
                    .map((group) => (
                      <ListBox.Section key={group}>
                        <ListBox.Item
                          key={`${group}-header`}
                          id={`${group}-header`}
                          isDisabled
                          textValue={group}
                        >
                          <Label className="text-xs tracking-wide text-muted uppercase">
                            {group}
                          </Label>
                        </ListBox.Item>
                        {filtered
                          .filter((c) => c.group === group)
                          .map((c) => (
                            <ListBox.Item key={c.id} id={c.id} textValue={c.label}>
                              <span className="flex items-center gap-2">
                                {c.icon}
                                <Label>{c.label}</Label>
                              </span>
                            </ListBox.Item>
                          ))}
                      </ListBox.Section>
                    ))}
                </ListBox>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-default px-4 py-2 text-xs text-muted">
              <span>Navigate with arrow keys</span>
              <span className="flex items-center gap-1">
                <Kbd>esc</Kbd> to close
              </span>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
