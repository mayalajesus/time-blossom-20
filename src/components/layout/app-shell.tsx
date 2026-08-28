import {
  Button,
  Description,
  Form,
  I18nProvider as HeroI18nProvider,
  Input,
  Label,
  ListBox,
  Popover,
  Select,
  TextField,
} from "@heroui/react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderKanban,
  PanelLeft,
  Puzzle,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { CommandMenu } from "@/components/command-menu";
import { HeaderTimerControl } from "@/components/header-timer-control";
import { LogTimeModal } from "@/components/log-time-modal";
import { ProfileMenu } from "@/components/profile-menu";
import { FormAlert } from "@/components/form-feedback";
import { AppI18nProvider, useI18n } from "@/lib/i18n";
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

const reportViews = [
  { id: "summary", label: "Summary" },
  { id: "detailed", label: "Detailed" },
  { id: "weekly", label: "Weekly" },
  { id: "team", label: "Team" },
] as const;

type ReportView = (typeof reportViews)[number]["id"];

function getReportView(search: unknown): ReportView {
  if (search && typeof search === "object" && "view" in search) {
    const value = (search as { view?: unknown }).view;
    if (reportViews.some((report) => report.id === value)) return value as ReportView;
  }
  return "detailed";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { preferences, sessionStatus } = useStore();
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const dark = preferences.theme === "dark" || (preferences.theme === "system" && systemDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    root.style.colorScheme = dark ? "dark" : "light";
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#050505" : "#f5f6f8");
  }, [dark]);

  return (
    <AppI18nProvider locale={preferences.language}>
      <HeroI18nProvider locale={preferences.language}>
        {sessionStatus === "signed-out" ? (
          <SignedOutScreen />
        ) : (
          <AppShellContent>{children}</AppShellContent>
        )}
      </HeroI18nProvider>
    </AppI18nProvider>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const { settings } = useStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const reportsActive = location.pathname === "/reports";
  const activeReportView = getReportView(location.search);
  const [reportsOpen, setReportsOpen] = useState(reportsActive);

  useEffect(() => {
    setReportsOpen(reportsActive);
  }, [location.pathname, reportsActive]);

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
            aria-label={t("Toggle sidebar")}
            isIconOnly
            size="sm"
            variant="tertiary"
            onPress={() => setCollapsed((c) => !c)}
          >
            <PanelLeft className="size-4" />
          </Button>
        </div>

        <nav className="mt-3 flex flex-1 flex-col gap-0.5">
          {nav.map((item) =>
            item.label === "Reports" ? (
              <div key={item.to} className="relative">
                {collapsed && (
                  <Popover isOpen={reportsOpen} onOpenChange={setReportsOpen}>
                    <Popover.Trigger>
                      <Button
                        aria-controls="reports-submenu-collapsed"
                        aria-expanded={reportsOpen}
                        aria-label={t("Reports")}
                        isIconOnly
                        variant={reportsActive ? "secondary" : "ghost"}
                        className={`w-full justify-center rounded-lg px-2.5 py-2 text-sm ${
                          reportsActive ? "bg-surface-secondary text-foreground" : "text-muted"
                        }`}
                      >
                        <item.icon className="size-4 shrink-0" />
                      </Button>
                    </Popover.Trigger>
                    <Popover.Content
                      placement="right top"
                      className="w-44 max-w-[calc(100vw-1rem)] p-1"
                    >
                      <nav id="reports-submenu-collapsed" aria-label={t("Report views")}>
                        {reportViews.map((view) => (
                          <Link
                            key={view.id}
                            to="/reports"
                            search={{ view: view.id }}
                            className={`block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-secondary hover:text-foreground ${
                              reportsActive && activeReportView === view.id
                                ? "bg-surface-secondary text-foreground"
                                : "text-muted"
                            }`}
                          >
                            {t(view.label)}
                          </Link>
                        ))}
                      </nav>
                    </Popover.Content>
                  </Popover>
                )}

                {!collapsed && (
                  <>
                    <Button
                      aria-controls="reports-submenu-expanded"
                      aria-expanded={reportsOpen}
                      aria-label={`${t(reportsOpen ? "Collapse" : "Expand")} ${t("Reports")}`}
                      variant={reportsActive ? "secondary" : "ghost"}
                      className={`w-full justify-start gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:text-foreground ${
                        reportsActive
                          ? "bg-surface-secondary text-foreground"
                          : "text-muted hover:bg-surface-secondary"
                      }`}
                      onPress={() => setReportsOpen((open) => !open)}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-left">{t(item.label)}</span>
                      {reportsOpen ? (
                        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
                      ) : (
                        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
                      )}
                    </Button>
                    {reportsOpen && (
                      <nav
                        id="reports-submenu-expanded"
                        aria-label={t("Report views")}
                        className="ml-6 border-l border-default pl-2"
                      >
                        {reportViews.map((view) => (
                          <Link
                            key={view.id}
                            to="/reports"
                            search={{ view: view.id }}
                            className={`block rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-surface-secondary hover:text-foreground ${
                              reportsActive && activeReportView === view.id
                                ? "bg-surface-secondary text-foreground"
                                : "text-muted"
                            }`}
                          >
                            {t(view.label)}
                          </Link>
                        ))}
                      </nav>
                    )}
                  </>
                )}
              </div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-surface-secondary text-foreground" }}
                aria-label={collapsed ? t(item.label) : undefined}
                title={collapsed ? t(item.label) : undefined}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
              >
                <item.icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{t(item.label)}</span>}
              </Link>
            ),
          )}
        </nav>

        <div className="mt-3 border-t border-default pt-3">
          <ProfileMenu showName={!collapsed} />
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
              <Label className="sr-only">{t("Search")}</Label>
              <Input placeholder={`${t("Search…")}  (Ctrl+K)`} />
            </TextField>
          </Form>
          <div className="ml-auto flex items-center gap-2">
            <HeaderTimerControl />
            <div className="md:hidden">
              <ProfileMenu />
            </div>
          </div>
        </header>

        <nav
          aria-label={t("Mobile navigation")}
          className="no-scrollbar flex gap-1 overflow-x-auto border-b border-default px-4 py-2 md:hidden"
        >
          {nav.map((item) =>
            item.label === "Reports" ? (
              <div key={item.to} className="relative shrink-0">
                <Button
                  aria-controls="reports-submenu-mobile"
                  aria-expanded={reportsOpen}
                  variant={reportsActive ? "secondary" : "ghost"}
                  className={`gap-2 rounded-lg px-3 py-2 text-sm hover:text-foreground ${
                    reportsActive
                      ? "bg-surface-secondary text-foreground"
                      : "text-muted hover:bg-surface-secondary"
                  }`}
                  onPress={() => setReportsOpen((open) => !open)}
                >
                  <item.icon aria-hidden="true" className="size-4" />
                  <span>{t(item.label)}</span>
                  {reportsOpen ? (
                    <ChevronDown aria-hidden="true" className="size-4" />
                  ) : (
                    <ChevronRight aria-hidden="true" className="size-4" />
                  )}
                </Button>
                {reportsOpen && (
                  <nav
                    id="reports-submenu-mobile"
                    aria-label={t("Report views")}
                    className="absolute left-0 top-full z-20 mt-1 w-44 rounded-xl border border-default bg-surface p-1 shadow-lg"
                  >
                    {reportViews.map((view) => (
                      <Link
                        key={view.id}
                        to="/reports"
                        search={{ view: view.id }}
                        className={`block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-secondary hover:text-foreground ${
                          reportsActive && activeReportView === view.id
                            ? "bg-surface-secondary text-foreground"
                            : "text-muted"
                        }`}
                      >
                        {t(view.label)}
                      </Link>
                    ))}
                  </nav>
                )}
              </div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-surface-secondary text-foreground" }}
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
              >
                <item.icon aria-hidden="true" className="size-4" />
                <span>{t(item.label)}</span>
              </Link>
            ),
          )}
        </nav>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>

      <CommandMenu isOpen={cmdOpen} onOpenChange={setCmdOpen} onLogTime={() => setLogOpen(true)} />
      <LogTimeModal isOpen={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}

function SignedOutScreen() {
  const { members, currentMember, resumeSession } = useStore();
  const { t, error } = useI18n();
  const activeMembers = members.filter((member) => member.status === "active");
  const [memberId, setMemberId] = useState(
    currentMember?.status === "active" ? currentMember.id : (activeMembers[0]?.id ?? ""),
  );
  const [sessionError, setSessionError] = useState<string | null>(null);

  const continuePreview = () => {
    const result = resumeSession(memberId);
    if (!result.success) {
      setSessionError(result.error);
      return;
    }
    setSessionError(null);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-secondary text-accent">
          <Clock aria-hidden="true" className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">{t("You are signed out")}</h1>
        <p className="mt-2 text-sm text-muted">{t("Choose a preview identity to continue.")}</p>

        {sessionError ? (
          <div className="mt-5 text-left">
            <FormAlert title={t("Could not resume preview")} description={error(sessionError)} />
          </div>
        ) : null}

        {activeMembers.length > 0 ? (
          <div className="mt-5 space-y-4 text-left">
            <div className="flex flex-col gap-2">
              <Label>{t("Preview identity")}</Label>
              <Select
                aria-label={t("Preview identity")}
                value={memberId}
                onChange={(key) => {
                  setMemberId(String(key ?? ""));
                  setSessionError(null);
                }}
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {activeMembers.map((member) => (
                      <ListBox.Item key={member.id} id={member.id} textValue={member.name}>
                        <div className="flex min-w-0 flex-col">
                          <Label>{member.name}</Label>
                          <Description>{t(member.role)}</Description>
                        </div>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <Button className="w-full" onPress={continuePreview} isDisabled={!memberId}>
              {t("Continue to preview")}
            </Button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted">{t("No active preview identities.")}</p>
        )}
      </section>
    </main>
  );
}
