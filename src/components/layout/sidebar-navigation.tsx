import { Button, Popover } from "@heroui/react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderKanban,
  Puzzle,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const workspaceNavigation: NavigationItem[] = [
  { to: "/tracker", label: "Tracker", icon: Clock },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/clients", label: "Clients", icon: Building2 },
  { to: "/team", label: "Team", icon: Users },
];

const managementNavigation: NavigationItem[] = [
  { to: "/integrations", label: "Integrations", icon: Puzzle },
  { to: "/settings", label: "Settings", icon: Settings },
];

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

function isNavigationItemActive(pathname: string, item: NavigationItem) {
  return pathname === item.to || (item.to !== "/tracker" && pathname.startsWith(`${item.to}/`));
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">
      {children}
    </div>
  );
}

function NavigationLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem;
  collapsed: boolean;
  onNavigate: (() => void) | undefined;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const active = isNavigationItemActive(location.pathname, item);

  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? t(item.label) : undefined}
      title={collapsed ? t(item.label) : undefined}
      onClick={onNavigate}
      className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface hover:bg-surface-secondary hover:text-foreground ${
        active ? "bg-surface-secondary text-foreground" : "text-muted"
      } ${collapsed ? "w-10 justify-center px-2.5" : ""}`}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <item.icon aria-hidden="true" className="size-4" />
      </span>
      {!collapsed ? <span className="min-w-0 truncate">{t(item.label)}</span> : null}
    </Link>
  );
}

function ReportsNavigation({
  collapsed,
  reportsOpen,
  onReportsOpenChange,
  onNavigate,
}: {
  collapsed: boolean;
  reportsOpen: boolean;
  onReportsOpenChange: (open: boolean) => void;
  onNavigate: (() => void) | undefined;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const reportsActive = location.pathname === "/reports";
  const activeReportView = getReportView(location.search);

  const reportLinks = (
    <nav aria-label={t("Report views")} className={collapsed ? "space-y-0.5" : "space-y-0.5"}>
      {reportViews.map((view) => {
        const active = reportsActive && activeReportView === view.id;
        return (
          <Link
            key={view.id}
            to="/reports"
            search={{ view: view.id }}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`block rounded-xl px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface hover:bg-surface-secondary hover:text-foreground ${
              active ? "bg-surface-secondary text-foreground" : "text-muted"
            }`}
          >
            {t(view.label)}
          </Link>
        );
      })}
    </nav>
  );

  if (collapsed) {
    return (
      <Popover isOpen={reportsOpen} onOpenChange={onReportsOpenChange}>
        <Popover.Trigger>
          <Button
            aria-controls="reports-submenu-collapsed"
            aria-expanded={reportsOpen}
            aria-label={t("Reports")}
            isIconOnly
            variant={reportsActive ? "secondary" : "ghost"}
            className={`mx-auto block h-10 min-h-10 w-10 rounded-xl px-2.5 py-0 text-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
              reportsActive ? "bg-surface-secondary text-foreground" : "text-muted"
            }`}
          >
            <span className="flex size-5 shrink-0 items-center justify-center">
              <BarChart3 aria-hidden="true" className="size-4" />
            </span>
          </Button>
        </Popover.Trigger>
        <Popover.Content
          placement="right top"
          className="w-44 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl p-1"
        >
          <div id="reports-submenu-collapsed">{reportLinks}</div>
        </Popover.Content>
      </Popover>
    );
  }

  return (
    <div>
      <Button
        aria-controls="reports-submenu-expanded"
        aria-expanded={reportsOpen}
        aria-label={`${t(reportsOpen ? "Collapse" : "Expand")} ${t("Reports")}`}
        variant={reportsActive ? "secondary" : "ghost"}
        className={`h-10 min-h-10 w-full justify-start gap-3 rounded-xl px-3 py-0 text-sm font-normal focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface hover:text-foreground ${
          reportsActive
            ? "bg-surface-secondary text-foreground"
            : "text-muted hover:bg-surface-secondary"
        }`}
        onPress={() => onReportsOpenChange(!reportsOpen)}
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          <BarChart3 aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{t("Reports")}</span>
        {reportsOpen ? (
          <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
        )}
      </Button>
      {reportsOpen ? (
        <div id="reports-submenu-expanded" className="ml-6 mt-1 border-l border-separator pl-2">
          {reportLinks}
        </div>
      ) : null}
    </div>
  );
}

export function SidebarNavigation({
  collapsed = false,
  reportsOpen,
  onReportsOpenChange,
  onNavigate,
}: {
  collapsed?: boolean;
  reportsOpen: boolean;
  onReportsOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();

  return (
    <nav aria-label={t("Main navigation")} className="min-h-0 flex-1 overflow-y-auto py-3">
      {!collapsed ? <SectionLabel>{t("Workspace")}</SectionLabel> : null}
      <div className={collapsed ? "flex flex-col items-center gap-0.5" : "space-y-0.5"}>
        {workspaceNavigation.map((item) => (
          <NavigationLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
        <ReportsNavigation
          collapsed={collapsed}
          reportsOpen={reportsOpen}
          onReportsOpenChange={onReportsOpenChange}
          onNavigate={onNavigate}
        />
      </div>

      {!collapsed ? <SectionLabel>{t("Manage")}</SectionLabel> : null}
      <div
        className={`${collapsed ? "mt-3 flex flex-col items-center gap-0.5 border-t border-separator pt-3" : "space-y-0.5"}`}
      >
        {managementNavigation.map((item) => (
          <NavigationLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}
