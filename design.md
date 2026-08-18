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
  headers. Entries from the same date, task, project and billability state are
  grouped into one compact summary row.
- Multi-entry groups start collapsed and show their count, first start, last end
  and summed duration. The summary row is read-only and expands to reveal the
  individual entries; inline editing remains available on those detail rows.
- Descriptions stay attached to their individual entries and do not prevent
  grouping. Changing an entry's date, task, project or billability immediately
  recalculates its group membership.
- Use the week as the main navigation unit. Show a quiet week total and quiet
  day totals in section headers rather than summary cards.
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
  the same width, height and visual rhythm.
- Inline cell actions use compact HeroUI `Button` and `Input` components. Do
  not present static values as large filled fields or add native HTML controls
  when a HeroUI control already provides the interaction.
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
