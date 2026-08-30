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

The local preview is backed by versioned mock data in `localStorage`. It is
kept as a development and QA adapter while the Supabase production adapter is
introduced. The first backend milestone covers authentication, workspaces,
members, projects, clients, timers, entries, preferences and reports; billing
and external task integrations remain deferred.

Authentication uses the provider selected by `VITE_AUTH_PROVIDER`. Production
uses Supabase with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`;
homologation uses Neon Auth with `VITE_NEON_AUTH_URL`. The Neon Auth URL is
provided by Neon Auth and is different from `DATABASE_URL`. Both providers use
the same application auth flow. The shared Neon/Supabase migration process is
documented in `db/README.md`; Supabase Edge Function deployment notes are in
`supabase/README.md`. Keep service-role keys and database URLs on the server
only.

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

## Visual system

The product UI uses HeroUI Core and its semantic theme system as the source of
truth. The active theme follows the [HeroUI Theme Builder dashboard
configuration](https://heroui.com/en/themes?template=dashboard&chroma=0.13&hue=305&lightness=0.77): Inter, Radius M, Radius Form L and the Lavender accent theme.

The application uses the browser and HeroUI scale at 100%; it does not apply
CSS `zoom` or a viewport-specific root font-size reduction. Layout classes are
reserved for structure, spacing, sizing, positioning and responsive behavior.
Colors, borders, shadows, radius, typography and component states come from
HeroUI tokens and component variants. The dark application canvas intentionally
uses `#060607`.

Interactive UI must use the corresponding HeroUI component. Searchable option
lists use `Autocomplete` with `SearchField` and `ListBox`; date selection uses
HeroUI date components. The only approved visual exception is the shadcn/ui
chart helper backed by Recharts, used for reports.

## Project structure

- `src/routes` contains file-based routes.
- `src/components` contains reusable product UI.
- `src/lib/mock-data.ts` contains prototype records.
- `src/lib/store.tsx` contains the local state model and shared store contract.
- `src/lib/permissions.ts` contains pure permission rules used by the store and
  domain tests.
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

## Workspaces

- Each active identity can create up to five workspaces, including archived
  workspaces in that count. Shared workspaces received through membership do
  not count toward that limit.
- A workspace accepts at most 50 active members and pending invitations. Its
  members, clients, projects, time entries, settings and Trello state are
  isolated from every other workspace.
- New workspaces start empty with default tracking settings. The creator is
  their `Owner`; workspace roles and access are specific to each membership.
- The workspace switcher is available from the sidebar, and `Workspaces` is
  available in the avatar menu immediately above `Settings`. The sidebar uses
  a generic workspace icon without a logo or initials avatar; the optional
  workspace logo is reserved for report PDFs.
- Owners can edit, archive and restore their own workspaces. Archived
  workspaces are read-only, remain visible on the Workspaces page for
  restoration, and never appear in the workspace switcher. Archiving the
  current workspace moves the user to the first available active workspace;
  the last active workspace cannot be archived. Members of another owner's
  workspace can leave it; an Owner must archive their workspace instead.
- Workspace name, default billability and week start are edited together in the
  workspace edit modal; personal preferences remain in Settings.
- A running timer belongs to its source workspace. Switching workspace asks the
  user to `Pause and switch`; paused timers remain in their original workspace
  and are not stopped or converted into entries automatically.
- Workspace logos are stored locally, limited to PNG, JPG or WebP files of
  approximately 500 KB, and are used exclusively as PDF report branding. CSV
  and XLSX exports remain text-only.
- The local preview has no real authentication or cross-device sync. The
  versioned local snapshot migrates previous workspace shapes and falls back to
  safe seed data when storage is invalid. Production data is created in a new
  Supabase environment rather than imported from browser storage.

## Reports

Reports use one shared pipeline for period selection, permission scope, filters,
aggregation and export. The four views have distinct purposes:

- `Detailed` lists every filtered entry line by line.
- `Summary` groups the same dataset by Project, Client, Member, Task or Date,
  with an optional second grouping level.
- `Weekly` always shows one complete week grouped by Project or Member.
- `Team` compares tracked, billable, internal, records, projects, clients and
  average active-day time per member.

Available period presets are Today, Yesterday, This week, Last week, Last 2
weeks, This month, Last month, This year, Last year and Custom range. Reports
can filter by Team (Admin/Owner only), Client, Project, Task, Description and
Billability. Tags and approval status are intentionally not offered because
they are not part of the current time-entry model. Members see and export only
their own records; Admins and Owners can use workspace scope. CSV, XLSX and
the downloadable PDF export uses the exact period, filters and view currently
shown, including workspace branding when configured. Summary, Weekly and Team
use complementary lightweight shadcn/ui chart visualizations backed by
Recharts: circular progress for proportions and concentration, and progress
bars for ranked comparisons and daily activity. Detailed remains table-first,
keeping each report useful without loading a heavy charting layer.
