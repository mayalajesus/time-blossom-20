# Time Blossom development guide

## Product direction

Time Blossom is a focused time tracking workspace for freelancers, independent
professionals and small teams. Keep the experience calm, fast to understand and
useful without enterprise-style clutter.

## Stack and structure

- React 19, TypeScript and Vite.
- Vite and file-based TanStack Router routes under `src/routes`.
- HeroUI for product UI, Tailwind CSS for layout and tokens, Lucide for icons.
- The frontend keeps a local preview adapter for development and QA. The
  Supabase adapter is the production path; never expose administrative keys in
  browser code.
- Keep shared state and domain types in `src/lib`, reusable UI in
  `src/components`, and route-specific composition in `src/routes`.

## Commands

```bash
bun install
bun run dev
bun run build
bun run lint
```

Use the existing package manager and scripts. Do not commit generated output
such as `node_modules`, `dist`, `.output` or `.wrangler`.

## UI rules

- Preserve the Today → choose task → start → work → stop flow.
- Use HeroUI's official components as the only visual source of truth for
  active product controls and surfaces. Use `Card` for route-level surfaces,
  `PageHeader` for page introductions and `DataTable` for standard tables.
  Shared components such as `ActionDropdown`, `ProjectSelect` and
  `TrackerPeriodFilter` are thin compositions of HeroUI primitives, not a
  second visual system.
- Keep the border policy intentionally quiet: surfaces and cards use contrast,
  spacing and elevation; visible borders are reserved for fields, table
  separators, focus, validation and boundaries that need explicit separation.
- Do not add CSS classes that recreate a HeroUI field, card, menu, focus ring,
  radius or state. Use the official HeroUI component variants and keep local
  classes limited to layout, sizing, truncation and responsive behavior.
- Every primary screen needs loading, populated, empty and error treatment.
- Loading uses the shared HeroUI Spinner; empty states are reserved for real
  zero-data conditions.
- Keep keyboard focus visible, icon buttons labelled and responsive layouts free
  of accidental horizontal overflow.
- Standard read-only tables must use `DataTable`, which owns the HeroUI table
  variant and horizontal `ScrollContainer`. The Tracker may use its semantic
  fixed-column table for inline editing, but its local styles may only control
  geometry and scrolling. Never allow a data table to overflow the page body.
- Do not import from `src/components/ui` or add another component library for
  active product UI. Hidden file inputs are allowed only as the technical
  browser API behind a visible HeroUI upload button. Native markup in boot/error
  fallbacks and generated PDF/print HTML is explicitly out of the app shell.
- Use motion only for small state changes, menus, dialogs and item transitions.

## Change hygiene

- Keep route URLs stable unless a migration is explicitly required.
- Prefer small, typed changes that preserve the mock data model.
- Run lint and build before handing off a change.
