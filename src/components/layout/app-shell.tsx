import {
  Button,
  Description,
  Drawer,
  Form,
  I18nProvider as HeroI18nProvider,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Clock, Menu, PanelLeft } from "lucide-react";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { CommandMenu } from "@/components/command-menu";
import { HeaderTimerControl } from "@/components/header-timer-control";
import { LogTimeModal } from "@/components/log-time-modal";
import { ProfileMenu } from "@/components/profile-menu";
import { FormAlert } from "@/components/form-feedback";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { SidebarNavigation } from "@/components/layout/sidebar-navigation";
import { DrawerTriggerRegistration } from "@/components/overlay-trigger-registration";
import { AppI18nProvider, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";

const publicAuthPaths = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/callback",
  "/invite/accept",
]);

export function AppShell({ children }: { children: ReactNode }) {
  const { preferences, sessionStatus } = useStore();
  const { configured, loading: authLoading, session } = useAuth();
  const currentLocation = useLocation();
  const navigate = useNavigate();
  const isPublicAuthPath = publicAuthPaths.has(currentLocation.pathname);
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

  useEffect(() => {
    if (!configured || authLoading || session || isPublicAuthPath) return;
    void navigate({ to: "/login", replace: true });
  }, [authLoading, configured, isPublicAuthPath, navigate, session]);

  if (configured && (authLoading || (!session && !isPublicAuthPath))) {
    const loadingLabel = document.documentElement.lang === "pt-BR" ? "Carregando" : "Loading";
    return (
      <main className="app-boot-screen">
        <span className="app-boot-spinner" role="status" aria-label={loadingLabel} />
      </main>
    );
  }

  return (
    <AppI18nProvider locale={preferences.language}>
      <HeroI18nProvider locale={preferences.language}>
        {isPublicAuthPath ? (
          children
        ) : sessionStatus === "signed-out" ? (
          <SignedOutScreen />
        ) : (
          <AppShellContent>{children}</AppShellContent>
        )}
      </HeroI18nProvider>
    </AppI18nProvider>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const reportsActive = location.pathname === "/reports";
  const [reportsOpen, setReportsOpen] = useState(reportsActive);

  useEffect(() => {
    setReportsOpen(reportsActive);
  }, [location.pathname, reportsActive]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

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
    <>
      <a className="skip-link" href="#main-content">
        {t("Skip to content")}
      </a>
      <div className="min-h-screen bg-background text-foreground">
        <aside
          className={`fixed inset-y-0 left-0 z-30 hidden h-screen shrink-0 flex-col overflow-hidden bg-surface p-2 md:flex ${
            collapsed ? "w-16" : "w-56"
          }`}
        >
          <div
            className={`flex gap-1 px-1 py-2 ${collapsed ? "flex-col items-center" : "items-center"}`}
          >
            <div className={collapsed ? "flex w-10 justify-center" : "min-w-0 flex-1"}>
              <ProfileMenu showName={!collapsed} showRole={!collapsed} />
            </div>
            <Button
              aria-label={t("Toggle sidebar")}
              isIconOnly
              size="sm"
              variant="ghost"
              className={`shrink-0 ${collapsed ? "size-10 min-w-10" : ""}`}
              onPress={() => setCollapsed((c) => !c)}
            >
              <PanelLeft aria-hidden="true" className="size-4" />
            </Button>
          </div>

          <SidebarNavigation
            collapsed={collapsed}
            reportsOpen={reportsOpen}
            onReportsOpenChange={setReportsOpen}
          />

          <div className="mt-3 shrink-0 px-1">
            <WorkspaceSwitcher collapsed={collapsed} popoverPlacement="footer" />
          </div>
        </aside>

        <div
          className={`min-h-screen min-w-0 transition-[padding] duration-200 ${
            collapsed ? "md:pl-16" : "md:pl-56"
          }`}
        >
          <header className="sticky top-0 z-10 flex items-center gap-2 bg-background/80 px-3 py-2.5 backdrop-blur sm:gap-3 sm:px-4 sm:py-3">
            <div className="md:hidden">
              <Button
                aria-label={t("Open navigation")}
                isIconOnly
                size="sm"
                variant="tertiary"
                onPress={() => setMobileNavOpen(true)}
              >
                <Menu aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <GlobalSearchForm
                className="max-w-sm"
                query={query}
                onQueryChange={setQuery}
                onSubmit={() => navigate({ to: "/search", search: { q: query } })}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <HeaderTimerControl />
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none md:px-8"
          >
            {children}
          </main>
        </div>

        <Drawer isOpen={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DrawerTriggerRegistration />
          <Drawer.Backdrop>
            <Drawer.Content placement="left" className="w-[min(18rem,calc(100vw-1rem))]">
              <Drawer.Dialog className="flex h-full flex-col">
                <Drawer.Header className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <ProfileMenu showName showRole />
                  </div>
                  <div className="sr-only">
                    <Drawer.Heading className="text-base font-semibold">
                      {t("Navigation")}
                    </Drawer.Heading>
                    <p className="mt-0.5 text-xs text-muted">{t("Time Blossom")}</p>
                  </div>
                  <Drawer.CloseTrigger aria-label={t("Close navigation")} />
                </Drawer.Header>
                <Drawer.Body className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                  <SidebarNavigation
                    reportsOpen={reportsOpen}
                    onReportsOpenChange={setReportsOpen}
                    onNavigate={() => setMobileNavOpen(false)}
                  />
                </Drawer.Body>
                <Drawer.Footer className="flex shrink-0 flex-col gap-2 px-3 py-3">
                  <WorkspaceSwitcher popoverPlacement="footer" />
                </Drawer.Footer>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>

        <CommandMenu
          isOpen={cmdOpen}
          onOpenChange={setCmdOpen}
          onLogTime={() => setLogOpen(true)}
        />
        <LogTimeModal isOpen={logOpen} onOpenChange={setLogOpen} />
      </div>
    </>
  );
}

function GlobalSearchForm({
  className,
  query,
  onQueryChange,
  onSubmit,
}: {
  className?: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();

  return (
    <Form
      className={`min-w-0 ${className ?? ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <TextField fullWidth name="global-search" value={query} onChange={onQueryChange}>
        <Label className="sr-only">{t("Search")}</Label>
        <Input placeholder={`${t("Search…")}  (Ctrl+K)`} />
      </TextField>
    </Form>
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

  const continueAccount = () => {
    const result = resumeSession(memberId);
    if (!result.success) {
      setSessionError(result.error);
      return;
    }
    setSessionError(null);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="surface-card w-full max-w-md p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-secondary text-accent">
          <Clock aria-hidden="true" className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">{t("You are signed out")}</h1>
        <p className="mt-2 text-sm text-muted">{t("Choose an account to continue.")}</p>

        {sessionError ? (
          <div className="mt-5 text-left">
            <FormAlert title={t("Could not continue")} description={error(sessionError)} />
          </div>
        ) : null}

        {activeMembers.length > 0 ? (
          <div className="mt-5 space-y-4 text-left">
            <div className="flex flex-col gap-2">
              <Label>{t("Account")}</Label>
              <Select
                aria-label={t("Account")}
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
                <Select.Popover className="hero-menu-surface">
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
            <Button className="w-full" onPress={continueAccount} isDisabled={!memberId}>
              {t("Continue")}
            </Button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted">{t("No accounts available.")}</p>
        )}
      </section>
    </main>
  );
}
