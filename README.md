# Time Blossom

Time Blossom is a minimal time tracking workspace for freelancers and small
teams. It helps people start a timer quickly, review their day, organize work
by project and client, and inspect lightweight reports.

## What is included

- Tracker dashboard with a live mock timer and manual time entry.
- Tracker, projects, clients, team and reports views.
- Mock Trello connection and sync states.
- Search and command menu interactions.
- Light, dark and system theme behavior.
- Responsive shell with keyboard-friendly controls.

The current version is a frontend prototype backed by local mock data. It does
not connect to a database, authentication provider, payment service or external
task API.

## Run locally

Install dependencies and start the development server:

```bash
bun install
bun run dev
```

The production checks are:

```bash
bun run lint
bun run build
```

## Project structure

- `src/routes` contains file-based routes.
- `src/components` contains reusable product UI.
- `src/lib/mock-data.ts` contains prototype records.
- `src/lib/store.tsx` contains the local state model.
- `design.md` documents the visual and interaction direction.
- `AGENTS.md` documents contribution conventions.
