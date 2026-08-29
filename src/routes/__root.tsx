import { Button, Toast, Typography } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "../components/layout/app-shell";
import { useI18n } from "../lib/i18n";
import { StoreProvider } from "../lib/store";
import { AuthProvider } from "../lib/auth-context";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <Typography type="h1" weight="bold">
          404
        </Typography>
        <Typography type="h2" weight="semibold" className="mt-4">
          {t("Page not found")}
        </Typography>
        <Typography type="body-sm" color="muted" className="mt-2">
          {t("The page you're looking for doesn't exist or has been moved.")}
        </Typography>
        <div className="mt-6">
          <Button onPress={() => navigate({ to: "/" })}>{t("Go home")}</Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <Typography type="h1" weight="semibold">
          {t("This page didn't load")}
        </Typography>
        <Typography type="body-sm" color="muted" className="mt-2">
          {t("Something went wrong on our end. You can try refreshing or head back home.")}
        </Typography>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onPress={() => {
              router.invalidate();
              reset();
            }}
          >
            {t("Try again")}
          </Button>
          <Button variant="secondary" onPress={() => router.navigate({ to: "/" })}>
            {t("Go home")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Time Blossom — Simple time tracking" },
      {
        name: "description",
        content: "Start a timer, organize your work and understand where your hours go.",
      },
      { name: "author", content: "Time Blossom" },
      { property: "og:title", content: "Time Blossom — Simple time tracking" },
      {
        property: "og:description",
        content: "A calm, focused workspace for tracking time across projects and clients.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico?v=orbit-3", sizes: "any" },
      { rel: "icon", href: "/icons/icon-32.png?v=orbit-3", sizes: "32x32", type: "image/png" },
      { rel: "icon", href: "/favicon.svg?v=orbit-3", type: "image/svg+xml" },
      {
        rel: "apple-touch-icon",
        href: "/icons/apple-touch-icon.png?v=orbit-3",
        sizes: "180x180",
      },
      { rel: "manifest", href: "/site.webmanifest?v=orbit-3" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StoreProvider>
          <AppShell>
            <RootOutlet />
          </AppShell>
        </StoreProvider>
      </AuthProvider>
      <Toast.Provider />
    </QueryClientProvider>
  );
}

function RootOutlet() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const metadata: Record<string, { title: string; description: string; ogDescription: string }> =
      {
        "/": {
          title: t("Time Blossom — Time tracking for small teams"),
          description: t(
            "Time Blossom is a minimal time tracker for freelancers and small teams: live timer, time entries, reports and client billing.",
          ),
          ogDescription: t(
            "Track hours, manage projects and bill clients with a calm, focused workspace.",
          ),
        },
        "/tracker": {
          title: `${t("Tracker")} — Time Blossom`,
          description: t(
            "Start the live timer, log time and manage your entries in one focused workspace.",
          ),
          ogDescription: t("Live timer and daily time entries in one focused view."),
        },
        "/today": {
          title: `${t("Tracker")} — Time Blossom`,
          description: t(
            "Start the live timer, log time and manage your entries in one focused workspace.",
          ),
          ogDescription: t("Live timer and daily time entries in one focused view."),
        },
        "/projects": {
          title: `${t("Projects")} — Time Blossom`,
          description: t(
            "Track hours per project, monitor status and open detailed project breakdowns.",
          ),
          ogDescription: t("All client and internal projects with tracked time at a glance."),
        },
        "/clients": {
          title: `${t("Clients")} — Time Blossom`,
          description: t("Manage clients, contacts and the projects connected to each client."),
          ogDescription: t("Client list with contacts and tracked time."),
        },
        "/team": {
          title: `${t("Team")} — Time Blossom`,
          description: t("Invite teammates, manage roles and track team hours."),
          ogDescription: t("Invite teammates and see tracked hours by member."),
        },
        "/reports": {
          title: `${t("Reports")} — Time Blossom`,
          description: t("Detailed, summary, weekly and team time reports."),
          ogDescription: t("Filter and understand tracked time."),
        },
        "/integrations": {
          title: `${t("Integrations")} — Time Blossom`,
          description: t("Connect Time Blossom to Trello and sync cards into tracked tasks."),
          ogDescription: t("Trello sync for your time tracking."),
        },
        "/settings": {
          title: `${t("Settings")} — Time Blossom`,
          description: t("Workspace settings and personal preferences."),
          ogDescription: t("Configure your Time Blossom workspace."),
        },
        "/search": {
          title: `${t("Search")} — Time Blossom`,
          description: t("Search projects, clients, teammates and time entries."),
          ogDescription: t("Find anything in your workspace."),
        },
      };
    const current = metadata[pathname] ?? metadata["/"]!;
    document.title = current.title;
    for (const [selector, content] of [
      ['meta[name="description"]', current.description],
      ['meta[property="og:title"]', current.title],
      ['meta[property="og:description"]', current.ogDescription],
    ] as const) {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", content);
    }
  }, [pathname, t]);

  return <Outlet />;
}
