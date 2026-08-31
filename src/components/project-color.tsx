import type { ReactNode } from "react";
import type { Project } from "@/lib/mock-data";
import { projectColorValue } from "@/lib/project-colors";

export function ProjectLabel({
  project,
  label,
  className = "",
}: {
  project?: Pick<Project, "color"> | null;
  label: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center ${className}`}>
      <span
        className="min-w-0 truncate"
        style={project ? { color: projectColorValue(project.color) } : undefined}
      >
        {label}
      </span>
    </span>
  );
}
