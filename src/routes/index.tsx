import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/today" });
  },
  head: () => ({
    meta: [
      { title: "Time Blossom — Time tracking for small teams" },
      {
        name: "description",
        content:
          "Time Blossom is a minimal time tracker for freelancers and small teams: live timer, timesheets, reports and client billing.",
      },
      { property: "og:title", content: "Time Blossom — Time tracking for small teams" },
      {
        property: "og:description",
        content: "Track hours, manage projects and bill clients with a calm, focused workspace.",
      },
    ],
  }),
  component: () => null,
});
