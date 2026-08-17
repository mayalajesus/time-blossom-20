import { Toast } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "../components/layout/app-shell";
import { StoreProvider } from "../lib/store";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
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
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Time Blossom — Simple time tracking",
      "/today": "Tracker — Time Blossom time tracking",
      "/timesheet": "Timesheet — Time Blossom time tracking",
      "/projects": "Projects — Time Blossom time tracking",
      "/clients": "Clients — Time Blossom time tracking",
      "/team": "Team — Time Blossom time tracking",
      "/reports": "Reports — Time Blossom time tracking",
      "/integrations": "Integrations — Time Blossom time tracking",
      "/settings": "Settings — Time Blossom time tracking",
      "/search": "Search — Time Blossom time tracking",
    };
    document.title = titles[pathname] ?? "Time Blossom — Simple time tracking";
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </StoreProvider>
      <Toast.Provider />
    </QueryClientProvider>
  );
}
