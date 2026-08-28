# Time Blossom design direction

## Product character

Time Blossom should feel quiet, clear and slightly premium. The interface
supports a quick return to work rather than asking users to configure a large
system before they can track time.

## Visual system

- Use HeroUI components as the default source of controls, overlays, tables,
  feedback and states.
- Use Tailwind utilities for spacing and responsive layout; avoid a second
  custom component framework.
- Use a restrained neutral surface palette with one accent for primary actions
  and status feedback.
- In dark mode, follow the HeroUI form-reference contrast hierarchy: a near-black
  canvas, distinct charcoal field surfaces, bright labels, cool blue-gray support
  text, vivid blue primary actions and clear red danger states.
- In light mode, use the same hierarchy through a soft gray canvas, white
  surfaces, tinted field fills and visible borders. Field controls must not use
  drop shadows as their primary separation mechanism; focus may use the shared
  accent ring.
- Use strong, readable headings and compact supporting text. Keep dense data
  scannable with tabular numerals and aligned values.
- Use Lucide icons with labels or tooltips. Do not use decorative icon-only
  controls without an accessible name.

## Layout

- Tracker is the product center: a compact timer composer is the primary
  action, followed by the selected week of time entries.
- Treat the timer composer as one responsive toolbar: at desktop widths it
  stays on one line with a flexible task field, controlled project width and
  non-shrinking time/actions/billability controls. At tablet and mobile sizes,
  wrapping is intentional and follows priority (task, project/time, actions,
  then compact billability), never accidental or page-wide.
- Keep the composer quiet and unified: Billable belongs to the primary
  control row, and the active state is communicated by the timer controls and
  live clock without adding a secondary status strip. Use min-width
  constraints and shrink-safe controls to preserve the toolbar's geometry
  across viewport sizes.
- Follow the familiar time-tracker hierarchy: composer, week total, then one
  aligned flat table with task, project/client, start, end, date, duration and
  quick actions. The date belongs in the Date column, not in repeated row
  headers. Days are shown from most recent to oldest, while entries within a
  day remain ordered by start time. Entries from the same date, task, project
  and billability state are grouped into one compact summary row.
- Multi-entry groups start collapsed and show their count, first start, last end
  and summed duration. The summary row is read-only and expands to reveal the
  individual entries; inline editing remains available on those detail rows.
- Collapsed group summaries use the same neutral surface as ordinary entries.
  Only the individual detail rows receive the subtle secondary-surface tint
  while a group is expanded. Task descriptions align to the task title's left
  edge, while billability remains attached to the title line only.
- Group summaries preserve the same vertical rhythm as detail rows: the task
  line carries the count and expansion control, with a quiet second line such
  as `3 entries`. Start again and the actions menu occupy fixed, shared slots
  across summary and detail rows, so grouping never shifts the table's action
  geometry. The expansion control uses a subtle hover state and a visible
  focus ring without making the summary look like an input or card.
- Descriptions stay attached to their individual entries and do not prevent
  grouping. Changing an entry's date, task, project or billability immediately
  recalculates its group membership.
- Use the selected period as the main navigation unit. The Tracker opens on
  `This week`, and clicking the fixed-width period trigger opens the HeroUI
  range calendar directly; there is no preset menu or calendar icon in the
  trigger. Keep the label centered in a compact fixed-width control; weekly
  ranges use a compact visible format while the full year remains available
  to assistive labels and the calendar. The
  arrows move by week for aligned week ranges and by the custom range length
  for arbitrary dates. Custom ranges use the same compact date treatment as
  weekly ranges and do not show a `Custom range` label inside the trigger.
  When the selection is not the current week, expose a
  compact `This week` return action beside the next arrow. A custom selection
  displays the selected interval using the same compact date treatment. Show a
  quiet contextual total rather than summary cards.
- Keep one manual Add entry action beside the selected week's total. Avoid
  duplicate global, page-level and per-day actions when the timer composer and
  Date column are already visible.
- Prefer direct cell-level editing for the fields users need to correct most
  often. Clicking a value replaces only that value with its editor; never
  expand the row into a card and never add an Edit action.
- Duration is edited as `H:MM` and accepts compact Clockify-style values such as
  `2400`, `825`, `2h`, `2:45` and `45s`; it recalculates the end time while
  keeping the start time fixed. On narrow screens, the table owns horizontal
  scrolling so the page itself does not overflow. At the compact-desktop `1200px` CSS
  viewport and above, the table fits beside the open sidebar without
  horizontal scrolling.
- Use the effective CSS viewport, rather than the physical diagonal of a
  laptop, as the responsive reference because operating-system display scaling
  changes the number of CSS pixels available at browser zoom 100%.
- Keep the table at a stable minimum width below `1200px` so time inputs and
  action controls remain fully visible. Above that threshold, compact the
  horizontal cell padding while preserving the same column alignment. Inline
  editors must preserve the row's column geometry, and compact actions must
  remain square instead of shrinking into pills.
- `Start` and `End` are separate table columns with fixed-width controls. Each
  field is edited independently in place, so the static and editing states keep
  the same width, height and visual rhythm. Overnight entries remain grouped by
  their start date; the End value shows a quiet `+1`, `+2` or equivalent day
  offset instead of splitting the entry into another row.
- Inline cell actions use compact HeroUI `Button` and `Input` components. Do
  not present static values as large filled fields or add native HTML controls
  when a HeroUI control already provides the interaction.
- Compact page filters and action-level selectors use the same HeroUI pill
  radius as primary action buttons, keeping their height, focus ring and
  horizontal rhythm consistent across the system. Form fields retain the
  standard HeroUI field radius so action controls remain distinct from inputs.
- Project selectors use one shared searchable HeroUI pattern. The popover
  always opens with a focused `Search projects` field, matches project and
  client names without case or accent sensitivity, preserves `No project` (and
  `All projects` in filters), and reports `No projects found` when needed.
  Archived projects stay hidden for new assignments but remain available when
  editing a historical entry; the popover remains viewport-constrained and
  never changes the Tracker table geometry.
- The live timer is a persistent state, not a page-local counter. A timestamp
  is the source of truth for running time, while paused time is stored as
  accumulated seconds. The active timer survives reloads, route changes and
  browser restarts through local storage, and is cleared only after an explicit
  stop action. A stopped timer uses its start date and stores an optional end
  date when the session crosses midnight; `seconds` remains authoritative for
  totals, including sessions that span more than one day. Task, project and
  billability remain editable while the timer is active and are persisted with
  the timer. Only one active timer is allowed, and manual creation is blocked
  while a timer is running or paused. Timers shorter than one minute preserve
  their real seconds instead of being silently rounded up.
- Entries, projects, clients and workspace settings use a versioned local
  storage snapshot in the mock application. Invalid snapshots fall back to
  seeds without replacing a valid active timer. This is local continuity, not
  cross-device synchronization.
- All date selection uses the shared HeroUI DatePicker and Calendar pattern.
  Native browser date pickers are not used; inline date edits and manual log
  forms share the same calendar, keyboard navigation and visual language. The
  inline Date field keeps a compact fixed footprint, reserves space for the
  calendar trigger, and anchors the popover to that trigger so editing never
  overlaps adjacent columns. Selecting a date closes the calendar once, keeps
  the selected value in the field, and the popover flips or constrains itself
  to the available visual viewport on small screens. Calendar surfaces are
  compact, use short weekday labels and never become scroll containers in
  either direction; responsive sizing and placement keep the complete grid
  visible without document overflow.
- Save valid inline changes automatically. Keep deletion as the only explicit
  destructive row action. Confirm deletion with HeroUI and offer a short
  HeroUI Toast `Undo` action that restores the complete entry.
- A time entry may be unassigned (`No project` / `No client`). Every project
  must have a valid client, and a time entry derives its client from its
  selected project rather than storing a second client relationship.
- Projects remain compact cards for quick scanning, with a stable hierarchy:
  identity in the header, the billability chip beside the three-dot action
  menu, and tracked time plus last activity anchored in a compact two-column
  footer without an internal divider.
  The reversible `active`/`on-hold` switch
  lives inside the action menu, while `archived` remains a separate read-only
  state. Long names and client names truncate without changing card geometry;
  the project link does not contain switches or action menus.
- Clients are managed in the existing responsive table. They have no billable
  status; billability belongs to the project default and can be overridden on
  each task/time entry. Client creation uses a HeroUI form, while deletion is
  confirmed in a HeroUI modal and blocked when projects still reference it.
- Team is an access-management surface. Invite members with email and a
  `Member` or `Admin` role; `Owner` access remains reserved. Pending invitations
  stay in the same table with an `Invited` status, show `Resend invite` and
  `Cancel invite` in the shared action menu, and use HeroUI Toast/Modal
  feedback. The local mock prepares and persists invitation state, while real
  email delivery remains an integration boundary. Removing an active member
  is an explicit, confirmed access-revocation action: it removes current
  project assignments but preserves tracked history and reports. The Owner and
  the last Admin are protected. Removed members remain visible as `Removed`
  for auditability and can be restored; restoration does not automatically
  reassign projects. Invitation cancellation remains a separate action.
- Archive and restore are explicit actions in the project card menu. Archiving
  requires a HeroUI confirmation modal, keeps existing entries intact, and
  moves the project out of Active and Inactive until it is restored.
- Desktop uses a collapsible sidebar and a focused content column.
- The desktop sidebar is fixed to the viewport; only the content column scrolls,
  while the collapsed state preserves the same fixed rail.
- The sidebar is organized into `Workspace` (Tracker, Projects, Clients, Team
  and Reports) and `Manage` (Integrations and Settings). Section labels are
  quiet and disappear in the collapsed rail without removing accessible names.
- The expanded desktop sidebar is 224px wide and keeps its navigation hierarchy
  intentionally light. The profile avatar/menu is anchored at the top, while
  workspace selection is anchored in the footer. The global HeroUI search
  remains in the header at every responsive size, preserving one predictable
  location.
- Small screens replace the horizontal navigation strip with a left HeroUI
  Drawer. The header keeps only menu, search and timer access; the Drawer
  mirrors the desktop hierarchy with profile at the top, grouped navigation in
  the middle and workspace selection in the footer.
- Navigation links use a calm `bg-surface-secondary` active state, visible
  focus, truncation for long labels and consistent HeroUI radius and density.
  The workspace logo and workspace initials/avatar are never shown in the
  sidebar; a generic workspace icon is used only as a compact footer switcher
  control, while the optional logo remains reserved for report PDFs. The
  profile avatar remains the only identity avatar in the sidebar and is placed
  at the top; workspace controls use neutral system color rather than accent
  color. The collapse/expand control is neutral at rest and only gains a
  background on hover or visible focus. When no profile photo exists, the
  identity avatar uses the system gradient fallback rather than initials.
- Prefer one clear primary action per surface. Secondary actions should remain
  contextual and visually quiet.
- Menus opened by three-dot action triggers use the shared HeroUI
  `ActionDropdown` pattern: compact rows, aligned icons, rounded hover and
  focus states, and responsive viewport-constrained popovers.
- Reports is one sidebar section with an expandable submenu for `Detailed`,
  `Summary`, `Weekly` and `Team`. The parent uses `aria-expanded` and
  `aria-controls`; the active report view is highlighted and mirrored by the
  page-level HeroUI selector. Reports is highlighted only on `/reports`; its
  previously opened state never marks unrelated pages. The same navigation
  works in the expanded, collapsed and mobile Drawer layouts.
- Action dropdowns do not display keyboard shortcut badges. HeroUI keeps the
  interaction keyboard-accessible through focus management, arrow navigation,
  `Enter`, `Space`, `Escape`, and click-away dismissal.
- Destructive actions such as deleting or archiving use the HeroUI danger
  treatment; reversible and informational actions retain the default tone.

## Reports

- Reports are driven by one memoized pipeline: permission scope, period,
  filters, lookup maps, totals and the selected view. The period is the primary
  filter and is synchronized in the URL so a report can be reloaded without
  losing context.
- `Detailed` is a flat line-by-line table. `Summary` supports Project, Client,
  Member, Task or Date grouping with an optional second level. `Weekly` is
  always a complete week and can group by Project or Member. `Team` presents
  member-level totals, billing mix, records, projects, clients, active-day
  average and share.
- Report presets are Today, Yesterday, This week, Last week, Last 2 weeks, This
  month, Last month, This year, Last year and Custom range. Custom ranges use
  the HeroUI `RangeCalendar`, normalize reversed selections and close after a
  valid range is selected. Weekly normalizes any selection to one full week.
- The filter bar supports Team, Client, Project, Task, Description and
  Billability. Team is available only to Admins and Owners. Client and Project
  filters support multiple selections and accent-insensitive search; `No
project` remains a first-class report category. Hidden filters keep their
  values until `Clear filters` is used. Tags and approval Status are not shown
  until the data model supports them.
- Members are scoped to their own entries in Reports and exports. Admins and
  Owners can analyze the full workspace. Detailed results are paginated at 50
  rows, while summary, weekly and team aggregation is calculated once per
  filter change. Empty results explain the state and provide a clear-filters
  action.
- CSV, XLSX and print-ready PDF exports receive the already filtered dataset
  and active view, preventing screen/export divergence. Export columns use the
  existing model only and retain overnight end-date indicators such as `+1`.
  PDF output is a clean, light, print-oriented document with Time Blossom
  branding, report context, active-filter metadata, totals and a paginated
  table whose header repeats across printed pages. The print window remains
  available so the user can choose the browser's `Save as PDF` destination.

## Interaction and states

- Timer states are idle, running and paused. The current state must be obvious
  from text, color and available actions, not color alone.
- Forms should show their purpose through labels, preserve entered values and
  disable submission only when the input is invalid.
- Long forms keep the HeroUI modal header and footer available while the body
  scrolls inside the viewport; the scrollbar stays visually hidden without
  removing wheel, touch or keyboard scrolling.
- Form controls use HeroUI defaults for size, spacing, radius, focus and color.
  `TextField` composes labels, inputs, descriptions and field errors; persistent
  validation uses HeroUI `Alert`, while short confirmations use `Toast`.
- Input surfaces must remain visibly distinct from their canvas in both themes,
  and muted text must stay readable without relying on low-contrast gray-on-gray
  states or field shadows.
- Loading uses the shared HeroUI Spinner with a compact status surface; empty
  states explain what is missing and provide the next action; errors offer
  recovery or a safe return path.
- Toasts confirm completed local actions. Alerts are reserved for conditions
  that require attention.
- Motion is limited to menus, dialogs, timer state changes and short item
  transitions. Avoid animated panels or decorative movement in the weekly list.

## Accessibility

- Keep a visible focus indicator and a logical keyboard order.
- Provide labels for search, form controls, switches and icon buttons.
- Use semantic headings and table headers.
- Keep important status text available to assistive technology.
- Validate responsive behavior at desktop, tablet and mobile widths.

## Permissions and preview identity

- The product permission matrix is:

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

- Roles are enforced as capabilities in the store, not treated as display-only labels.
- The Owner's own row in Team is read-only. It keeps the `Owner` role, `Active`
  status and tracked time visible but has no action menu. The Owner cannot change
  its own role, remove its own account, or edit its name/email; personal
  preferences remain available in Settings.
  Members can track and manage only their own entries, see shared workspace records,
  and use only projects assigned to them. Admins can manage projects, clients,
  project assignments, Members, workspace settings and integrations. Owners can
  also manage Admins, while the Owner account itself remains protected.
- Reports and exports are scoped to the active identity for Members and to the
  complete workspace for Admins and the Owner. Entries created by another person
  remain read-only for every role.
- Project visibility is shared, but project selectors for Members show only assigned
  active projects plus `No project`. Removing a member removes current assignments
  without changing historical entries; restoring access does not reassign projects.
- Team management protects Owner and the last active Admin. Admins can invite,
  remove, restore and promote Members, but cannot change existing Admins or invite
  Admins. Only the Owner can manage Admin roles.
- The Workspaces edit modal owns workspace-wide defaults: workspace name, default
  billability and week start. These controls require Admin or Owner access;
  reminders, weekly digest and idle detection remain personal preferences in
  Settings.
- `Preview identity` in Settings is a local-only mock control for Marina (Owner),
  Caio (Admin) and Helena (Member). It is not authentication. Switching requires
  an idle timer and reloads the application; active timers are stored under the
  selected identity so one preview user cannot affect another.
- Workspace data, members, settings and per-member preferences use a versioned
  local snapshot with safe seed fallback and migration from the previous shape.
  Store guards remain authoritative even if a hidden UI action is called directly.

## Workspaces

- Workspaces are the product's isolation boundary. Each identity can create up
  to five workspaces, including archived ones; shared workspaces do not count
  toward that owned-workspace limit. Each workspace supports at most 50 active
  members or pending invitations.
- Clients, projects, members, entries, tracking defaults, preferences and
  integrations belong to the active workspace. New workspaces start empty and
  the creator receives the `Owner` membership for that workspace.
- The sidebar workspace switcher does not show a workspace logo or initials
  avatar. It uses the workspace name and role in the footer when expanded and
  a generic workspace icon when compact. The optional logo is used exclusively
  for PDF report branding. The profile avatar/menu is placed at the top, and
  its menu places `Workspaces` immediately above `Settings`.
- Owners can edit, archive and restore their own workspaces. Archived
  workspaces are read-only. Members can leave a workspace owned by someone
  else; an Owner must archive rather than leave. Switching away from a running
  timer requires an explicit `Pause and switch` confirmation, while paused
  timers remain in their original workspace.
- Workspace logos are processed locally as PNG, JPG or WebP files up to
  approximately 500 KB. PDF exports include the active workspace name and logo
  when available, with `TB` as the no-logo fallback; CSV and XLSX remain
  text-only.
- The local account snapshot is versioned and migrates the former single
  workspace without discarding data. Invalid storage falls back to safe seeds.
  Production uses Supabase for authentication, persistence and cross-device
  synchronization; the local adapter remains available in development and QA.
