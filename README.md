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

## Permission model

The local preview uses three workspace roles. The workspace remains shared for
visibility, while mutations and report scope follow the active identity.

| Capability                              |    Member     |     Admin      |     Owner      |
| --------------------------------------- | :-----------: | :------------: | :------------: |
| Start, pause and stop own timer         |      Yes      |      Yes       |      Yes       |
| Create, edit and delete own entries     |      Yes      |      Yes       |      Yes       |
| Edit or delete another person's entries |      No       |       No       |       No       |
| View projects, clients and team         |      Yes      |      Yes       |      Yes       |
| Change own role or remove own account   |      No       |       No       |       No       |
| Use projects in tracking                | Assigned only |      All       |      All       |
| Create, edit or archive projects        |      No       |      Yes       |      Yes       |
| Change project billability              |      No       |      Yes       |      Yes       |
| Assign members to projects              |      No       |      Yes       |      Yes       |
| Create clients                          |      No       |      Yes       |      Yes       |
| Delete clients without projects         |      No       |      Yes       |      Yes       |
| View Reports                            |  Own records  | Full workspace | Full workspace |
| Export Reports                          |  Own records  | Full workspace | Full workspace |
| Invite Members                          |      No       |      Yes       |      Yes       |
| Invite Admins                           |      No       |       No       |      Yes       |
| Remove or restore Members               |      No       |      Yes       |      Yes       |
| Remove or restore Admins                |      No       |       No       |      Yes       |
| Promote Member to Admin                 |      No       |      Yes       |      Yes       |
| Demote Admin                            |      No       |       No       |      Yes       |
| Alter or remove Owner                   |      No       |       No       |       No       |
| Workspace settings                      |      No       |      Yes       |      Yes       |
| Personal preferences                    |      Yes      |      Yes       |      Yes       |
| Connect or sync integrations            |      No       |      Yes       |      Yes       |

The Owner cannot be removed or demoted, and the last active Admin cannot be
removed or demoted. In the local preview, Settings provides a `Preview identity`
control for Marina (Owner), Caio (Admin) and Helena (Member). This control is a
local role preview, not authentication. The Owner's own Team row is read-only:
there is no action menu, and personal preferences are managed in Settings.
