export type ProjectColorOption = {
  id: string;
  label: string;
  value: string;
};

export const projectColorOptions: readonly ProjectColorOption[] = [
  { id: "sky", label: "Sky", value: "#9ddcf3" },
  { id: "violet", label: "Violet", value: "#c6b5f2" },
  { id: "pink", label: "Pink", value: "#f2b3cb" },
  { id: "orange", label: "Orange", value: "#f2a77e" },
  { id: "emerald", label: "Emerald", value: "#a8e3c4" },
  { id: "amber", label: "Amber", value: "#f3d77c" },
  { id: "red", label: "Red", value: "#f2a1a1" },
  { id: "slate", label: "Slate", value: "#b0bbc8" },
];

export const defaultProjectColor = projectColorOptions[0]?.value ?? "#9ddcf3";

const legacyProjectColors: Record<string, string> = {
  accent: defaultProjectColor,
  "bg-accent": defaultProjectColor,
  success: "#a8e3c4",
  "bg-success": "#a8e3c4",
  warning: "#f3d77c",
  "bg-warning": "#f3d77c",
  danger: "#f2a1a1",
  "bg-danger": "#f2a1a1",
  foreground: "#b0bbc8",
  "bg-foreground": "#b0bbc8",
  "#38bdf8": "#9ddcf3",
  "#8b5cf6": "#c6b5f2",
  "#ec4899": "#f2b3cb",
  "#f97316": "#f2a77e",
  "#10b981": "#a8e3c4",
  "#f59e0b": "#f3d77c",
  "#ef4444": "#f2a1a1",
  "#64748b": "#b0bbc8",
};

export function projectColorValue(color: string | null | undefined): string {
  const normalized = color?.trim().toLowerCase() ?? "";
  return (
    legacyProjectColors[normalized] ??
    (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/.test(normalized) ? normalized : defaultProjectColor)
  );
}

export function projectColorTextValue(color: string | null | undefined): string {
  return `color-mix(in srgb, ${projectColorValue(color)} 62%, var(--foreground) 38%)`;
}
