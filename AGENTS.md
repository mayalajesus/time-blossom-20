# Time Blossom development guide

## Product direction

Time Blossom is a focused time tracking workspace for freelancers, independent
professionals and small teams. Keep the experience calm, fast to understand and
useful without enterprise-style clutter.

## Stack and structure

- React 19, TypeScript and Vite.
- Vite and file-based TanStack Router routes under `src/routes`.
- HeroUI for product UI, Gravity UI for the complete icon system, and Tailwind
  CSS only for layout and sizing utilities.
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
- For every new or modified UI, use only the official React components
  exported by `@heroui/react`. The complete allowed catalog is the official
  HeroUI React component catalog: Accordion, Alert, AlertDialog, Autocomplete,
  Avatar, Badge, Breadcrumbs, Button, ButtonGroup, Calendar, Card, Checkbox,
  CheckboxGroup, Chip, CloseButton, ColorArea, ColorField, ColorPicker,
  ColorSlider, ColorSwatch, ColorSwatchPicker, ComboBox, DateField, DatePicker,
  DateRangePicker, Description, Disclosure, DisclosureGroup, Drawer, Dropdown,
  ErrorMessage, FieldError, Fieldset, Form, Input, InputGroup, InputOTP, Kbd,
  Label, Link, ListBox, Meter, Modal, NumberField, Pagination, Popover,
  ProgressBar, ProgressCircle, RadioGroup, RangeCalendar, ScrollShadow,
  SearchField, Select, Separator, Skeleton, Slider, Spinner, Surface, Switch,
  Table, Tabs, TagGroup, TextArea, TextField, TimeField, Toast, ToggleButton,
  ToggleButtonGroup, Toolbar, Tooltip and Typography. The installed package
  version and the official API are the source of truth; inspect them before
  choosing a component.
- HeroUI Pro is not part of this project. Do not import, install, copy,
  recreate or approximate any HeroUI Pro component. If a required experience
  is unavailable in the Core catalog above, stop and report the limitation.
- Use HeroUI components with their default visual appearance. `className` may
  be used only for layout, spacing, dimensions, positioning, overflow and
  responsive behavior. Do not use visual utility classes such as `bg-*`,
  `text-*`, `border-*`, `ring-*`, `shadow-*`, `rounded-*`, `font-*`,
  `leading-*`, `hover:*`, `focus:*`, `transition-*` or animation classes.
  The documented HeroUI radius utilities `rounded-field`, `rounded-lg` and
  `rounded-xl` are allowed only when an official component composition must
  share the documented HeroUI example radius; do not use custom radius values.
  The official `bg-background` utility is allowed only on the root `Surface` so
  the app canvas follows the documented HeroUI background token.
- Do not use `style`, CSS modules, custom visual CSS selectors or arbitrary
  design tokens. The documented HeroUI dark-theme background override
  `--background: #060607` is the one approved product theme exception;
  documented HeroUI `size`, `variant` and `color` props are allowed only when
  supported by the installed API and semantically required. Never invent values
  or reproduce component visuals with CSS.
- Application-specific components are allowed only as organized, typed
  compositions of HeroUI components and application behavior/data. They must
  not implement a second visual system, expose look-alike primitives or add
  visual styling.
- Do not create wrappers, aliases, replacement primitives, visual helper
  components or custom markup intended to look like HeroUI. Do not use Radix,
  another component library or `src/components/ui` for active product UI. The
  only exception is the official shadcn/ui chart pattern in
  `src/components/ui/chart.tsx`, backed by Recharts, for chart visualizations
  only. Do not add other shadcn/ui components or use HeroUI Pro.
- Do not replace HeroUI controls with native `<button>`, `<input>`, `<select>`,
  `<textarea>` or equivalent interactive markup. Native markup is allowed only
  for non-interactive semantic structure and for browser APIs that are hidden
  behind an explicitly approved HeroUI control.
- If HeroUI does not provide the required component or behavior, stop and ask
  for a decision. Never approximate it with custom CSS or an invented element.
- Do not introduce new visual styles, style files or visual abstractions. Do
  not refactor existing custom UI merely to satisfy a new feature unless that
  migration is explicitly requested. Preserve existing behavior while keeping
  all new and changed UI inside this contract.
- Every primary screen needs loading, populated, empty and error treatment.
- Loading uses the shared HeroUI Spinner; empty states are reserved for real
  zero-data conditions.
- Keep keyboard focus visible, icon buttons labelled and responsive layouts free
  of accidental horizontal overflow.
- Use only real icons exported by `@gravity-ui/icons`. Do not import another icon
  library, handcraft SVG icons, or create text/CSS substitutes for missing icons.
- Hidden file inputs are allowed only as the technical browser API behind a
  visible HeroUI upload button. Native markup in boot/error fallbacks and
  generated PDF/print HTML is explicitly out of the app shell.
- Do not add animation or motion to new or modified UI unless the user
  explicitly requests it.

## HeroUI compliance gate

Before completing any UI task, review the diff against this contract. Every
user-facing control must use its corresponding HeroUI component (`Select` for
selects, `Button` for buttons, `Input` for text inputs, `TextArea` for text
areas, and so on). The changed code must not introduce a custom visual
component, a custom HeroUI look-alike, a styling override on a HeroUI
component, a new UI stylesheet or a native interactive control. If compliance
is uncertain, do not guess: report the conflict and ask for confirmation.

Full-migration completion additionally requires that all project-authored
visual CSS and visual utility classes have been removed or reduced to layout
and sizing only, that existing custom visual primitives have been replaced by
direct HeroUI Core components or behavior-only compositions, and that the app
passes its functional, accessibility and build checks without regressions.

Run the project checks before handing off:

```bash
bun run lint
bun run build
```

## Change hygiene

- Keep route URLs stable unless a migration is explicitly required.
- Prefer small, typed changes that preserve the mock data model.
- Run lint and build before handing off a change.

# CODEX BEHAVIOR — CAVEMAN MODE

## REGRA PRINCIPAL

EXECUTE. NÃO NARRE.

O usuário quer implementação, não uma transmissão ao vivo do seu processo.

### DURANTE A EXECUÇÃO

NÃO:

- explique o que está fazendo;
- descreva o que vai fazer;
- anuncie arquivos que vai analisar;
- explique sua estratégia;
- explique o raciocínio;
- faça auditorias não solicitadas;
- dê contexto desnecessário;
- diga "a origem do problema ficou clara";
- diga "vou utilizar...";
- diga "agora vou...";
- diga "antes de alterar...";
- narre comandos, buscas ou verificações;
- fique atualizando o usuário sobre seu progresso;
- proponha melhorias fora do pedido;
- faça perguntas desnecessárias;
- transforme uma tarefa simples em uma análise longa.

FAÇA:

- leia o código necessário;
- entenda o problema;
- implemente a solução;
- valide a implementação;
- corrija erros encontrados;
- termine.

Faça tudo isso silenciosamente.

## ESCOPO

Altere SOMENTE o que foi solicitado.

Não:

- refatore código não relacionado;
- altere componentes não relacionados;
- mude arquitetura;
- adicione funcionalidades;
- faça melhorias estéticas extras;
- substitua bibliotecas;
- altere padrões existentes;

a menos que isso seja necessário para cumprir explicitamente o pedido.

Se uma alteração adicional for tecnicamente indispensável, faça somente a alteração mínima necessária.

## COMUNICAÇÃO

Durante o trabalho:

[SEM NARRAÇÃO]

Ao terminar, responda SOMENTE:

"Feito."

Se houver algo que realmente impeça a conclusão:

"Bloqueado: [motivo em uma frase]."

Se houver uma decisão importante que o usuário precise saber:

"Feito. [uma frase curta explicando a decisão]."

Nada além disso.

## PRINCÍPIO

Usuário pediu X.

Faça X.

Não faça X + Y + Z.

Não explique X.

Não conte a história de como X foi feito.

Não transforme X em uma consultoria.

EXECUTE.
