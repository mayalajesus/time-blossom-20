# Time Blossom development guide

## Product direction

Time Blossom is a focused time tracking workspace for freelancers, independent
professionals and small teams. Keep the experience calm, fast to understand and
useful without enterprise-style clutter.

## Stack and structure

- React 19, TypeScript and Vite.
- Vite and file-based TanStack Router routes under `src/routes`.
- HeroUI for product UI, Tailwind CSS for layout and tokens, Lucide for icons.
- Local mock data only. Do not add backend, authentication, payment or live
  integration behavior to the frontend-only prototype.
- Keep shared state and domain types in `src/lib`, reusable UI in
  `src/components`, and route-specific composition in `src/routes`.

## Commands

```bash
bun install
bun run dev
bun run build
bun run lint
```

Use the existing lockfile and scripts. Do not commit generated output such as
`node_modules`, `.output` or `.wrangler`.

## UI rules

- Preserve the Today → choose task → start → work → stop flow.
- Reuse HeroUI components before introducing custom primitives.
- Every primary screen needs loading, populated, empty and error treatment.
- Keep keyboard focus visible, icon buttons labelled and responsive layouts free
  of accidental horizontal overflow.
- Use motion only for small state changes, menus, dialogs and item transitions.

## Change hygiene

- Keep route URLs stable unless a migration is explicitly required.
- Prefer small, typed changes that preserve the mock data model.
- Run lint and build before handing off a change.
