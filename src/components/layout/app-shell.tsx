import { Avatar, Button, Form, Input, Label, TextField } from "@heroui/react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  Clock,
  FolderKanban,
  Moon,
  PanelLeft,
  Plus,
  Puzzle,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { CommandMenu } from "@/components/command-menu";
import { LogTimeModal } from "@/components/log-time-modal";
import { useStore } from "@/lib/store";

const nav = [
  { to: "/tracker", label: "Tracker", icon: Clock },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/clients", label: "Clients", icon: Building2 },
  { to: "/team", label: "Team", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/integrations", label: "Integrations", icon: Puzzle },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

type ThemeMode = "system" | "light" | "dark";

export function AppShell({ children }: { children: ReactNode }) {
  const { settings } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [query, setQuery] = useState("");
  const isTrackerRoute = location.pathname === "/tracker" || location.pathname === "/today";

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const dark = themeMode === "dark" || (themeMode === "system" && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  const toggleTheme = () => setThemeMode(dark ? "light" : "dark");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-default bg-surface p-3 md:flex ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-1 py-2">
          {!collapsed && (
            <span className="truncate text-sm font-semibold">{settings.workspaceName}</span>
          )}
          <Button
            aria-label="Toggle sidebar"
            isIconOnly
            size="sm"
            variant="tertiary"
            onPress={() => setCollapsed((c) => !c)}
          >
            <PanelLeft className="size-4" />
          </Button>
        </div>

        <nav className="mt-3 flex flex-1 flex-col gap-0.5">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "bg-surface-secondary text-foreground" }}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 border-t border-default px-1 pt-3">
          <Avatar size="sm">
            <Avatar.Fallback>MD</Avatar.Fallback>
          </Avatar>
          {!collapsed && <span className="truncate text-sm text-muted">Marina Duarte</span>}
        </div>
      </aside>

      <div
        className={`min-h-screen min-w-0 transition-[padding] duration-200 ${
          collapsed ? "md:pl-16" : "md:pl-56"
        }`}
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-default bg-background/80 px-4 py-3 backdrop-blur">
          <Form
            className="max-w-sm flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/search", search: { q: query } });
            }}
          >
            <TextField fullWidth name="global-search" value={query} onChange={setQuery}>
              <Label className="sr-only">Search</Label>
              <Input placeholder="Search…  (Ctrl+K)" />
            </TextField>
          </Form>
          <div className="ml-auto flex items-center gap-2">
            <Button
              aria-label={`Theme: ${themeMode}`}
              isIconOnly
              variant="tertiary"
              onPress={toggleTheme}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {!isTrackerRoute ? (
              <Button onPress={() => setLogOpen(true)}>
                <Plus className="size-4" />
                Log time
              </Button>
            ) : null}
          </div>
        </header>

        <nav
          aria-label="Mobile navigation"
          className="no-scrollbar flex gap-1 overflow-x-auto border-b border-default px-4 py-2 md:hidden"
        >
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "bg-surface-secondary text-foreground" }}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
            >
              <item.icon aria-hidden="true" className="size-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>

      <CommandMenu
        isOpen={cmdOpen}
        onOpenChange={setCmdOpen}
        onLogTime={() => setLogOpen(true)}
        onToggleTheme={toggleTheme}
      />
      <LogTimeModal isOpen={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}
