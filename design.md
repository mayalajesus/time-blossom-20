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

- Today is the product center: timer first, daily totals second, entries third.
- Desktop uses a collapsible sidebar and a focused content column.
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
- Motion is limited to menus, dialogs, state changes and short item transitions.

## Accessibility

- Keep a visible focus indicator and a logical keyboard order.
- Provide labels for search, form controls, switches and icon buttons.
- Use semantic headings and table headers.
- Keep important status text available to assistive technology.
- Validate responsive behavior at desktop, tablet and mobile widths.
