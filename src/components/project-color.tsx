import type { ReactNode } from "react";
import type { Project } from "@/lib/mock-data";
import { projectColorValue } from "@/lib/project-colors";

export function ProjectColorDot({
  color,
  className = "",
}: {
  color: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full ring-2 ring-background ${className}`}
      style={{ backgroundColor: projectColorValue(color) }}
    />
  );
}

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
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      {project ? <ProjectColorDot color={project.color} /> : null}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
