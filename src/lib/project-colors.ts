export type ProjectColorOption = {
  id: string;
  label: string;
  value: string;
};

export const projectColorOptions: readonly ProjectColorOption[] = [
  { id: "sky", label: "Sky", value: "#38bdf8" },
  { id: "violet", label: "Violet", value: "#8b5cf6" },
  { id: "pink", label: "Pink", value: "#ec4899" },
  { id: "orange", label: "Orange", value: "#f97316" },
  { id: "emerald", label: "Emerald", value: "#10b981" },
  { id: "amber", label: "Amber", value: "#f59e0b" },
  { id: "red", label: "Red", value: "#ef4444" },
  { id: "slate", label: "Slate", value: "#64748b" },
];

export const defaultProjectColor = projectColorOptions[0]?.value ?? "#38bdf8";

const legacyProjectColors: Record<string, string> = {
  accent: defaultProjectColor,
  "bg-accent": defaultProjectColor,
  success: "#10b981",
  "bg-success": "#10b981",
  warning: "#f59e0b",
  "bg-warning": "#f59e0b",
  danger: "#ef4444",
  "bg-danger": "#ef4444",
  foreground: "#64748b",
  "bg-foreground": "#64748b",
};

export function projectColorValue(color: string | null | undefined): string {
  const normalized = color?.trim().toLowerCase() ?? "";
  if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/.test(normalized)) return normalized;
  return legacyProjectColors[normalized] ?? defaultProjectColor;
}
