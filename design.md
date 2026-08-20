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
  interval. Show a quiet contextual total rather than summary cards.
- Keep one manual Add entry action beside the selected week's total. Avoid
  duplicate global, page-level and per-day actions when the timer composer and
  Date column are already visible.
- Prefer direct cell-level editing for the fields users need to correct most
  often. Clicking a value replaces only that value with its editor; never
  expand the row into a card and never add an Edit action.
- Duration is edited as `H:MM` and recalculates the end time while keeping the
  start time fixed. On narrow screens, the table owns horizontal scrolling so
  the page itself does not overflow. At the compact-desktop `1200px` CSS
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
  totals, including sessions that span more than one day.
- All date selection uses the shared HeroUI DatePicker and Calendar pattern.
  Native browser date pickers are not used; inline date edits and manual log
  forms share the same calendar, keyboard navigation and visual language. The
  inline Date field keeps a compact fixed footprint, reserves space for the
  calendar trigger, and anchors the popover to that trigger so editing never
  overlaps adjacent columns. Selecting a date closes the calendar once, keeps
  the selected value in the field, and the popover flips or constrains itself
  to the available visual viewport on small screens.
- Save valid inline changes automatically. Keep deletion as the only explicit
  destructive row action.
- A time entry may be unassigned (`No project` / `No client`). Every project
  must have a valid client, and a time entry derives its client from its
  selected project rather than storing a second client relationship.
- Desktop uses a collapsible sidebar and a focused content column.
- The desktop sidebar is fixed to the viewport; only the content column scrolls,
  while the collapsed state preserves the same fixed rail.
- Small screens use a horizontally scrollable navigation strip and full-width
  content with no accidental page overflow.
- Prefer one clear primary action per surface. Secondary actions should remain
  contextual and visually quiet.

## Interaction and states

- Timer states are idle, running and paused. The current state must be obvious
  from text, color and available actions, not color alone.
- Forms should show their purpose through labels, preserve entered values and
  disable submission only when the input is invalid.
- Form controls use HeroUI defaults for size, spacing, radius, focus and color.
  `TextField` composes labels, inputs, descriptions and field errors; persistent
  validation uses HeroUI `Alert`, while short confirmations use `Toast`.
- Input surfaces must remain visibly distinct from their canvas in both themes,
  and muted text must stay readable without relying on low-contrast gray-on-gray
  states or field shadows.
- Loading uses skeletons; empty states explain what is missing and provide the
  next action; errors offer recovery or a safe return path.
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
