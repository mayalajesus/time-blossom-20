import type { ReactNode } from "react";

export function Surface({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`surface-card ${interactive ? "surface-card-interactive" : ""} ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}
