import { Description, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";

export type ProjectSelectValue = "all" | "none" | string;

export interface ProjectSelectProps {
  value: ProjectSelectValue;
  onChange: (value: ProjectSelectValue) => void;
  includeAll?: boolean;
  allowArchivedId?: string | null;
  ariaLabel: string;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

export function ProjectSelect({
  value,
  onChange,
  includeAll = false,
  allowArchivedId = null,
  ariaLabel,
}: ProjectSelectProps) {
  const { projects, clients } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  const availableProjects = useMemo(
    () =>
      projects.filter(
        (project) => includeAll || project.status !== "archived" || project.id === allowArchivedId,
      ),
    [allowArchivedId, includeAll, projects],
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return availableProjects;

    return availableProjects.filter((project) => {
      const clientName = clients.find((client) => client.id === project.clientId)?.name ?? "";
      return normalizeSearch(`${project.name} ${clientName}`).includes(normalizedQuery);
    });
  }, [availableProjects, clients, query]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const clientNameFor = (clientId: string) =>
    clients.find((client) => client.id === clientId)?.name ?? "Unknown client";

  return (
    <Select
      aria-label={ariaLabel}
      data-project-select
      fullWidth
      value={value}
      onChange={(key) => onChange(key === null ? "none" : String(key))}
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        setIsOpen(nextIsOpen);
        if (!nextIsOpen) setQuery("");
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover
        className="w-[var(--trigger-width)] max-w-[calc(100vw-2rem)] min-w-0"
        data-project-select-popover
      >
        <div className="flex flex-col gap-2 p-2">
          <TextField
            fullWidth
            name={`project-search-${ariaLabel.toLowerCase().replace(/\s+/g, "-")}`}
            value={query}
            onChange={setQuery}
          >
            <Label className="sr-only">Search projects</Label>
            <Input
              ref={searchRef}
              placeholder="Search projects..."
              onKeyDown={(event) => {
                if (event.key !== "Escape") event.stopPropagation();
              }}
            />
          </TextField>

          <ListBox aria-label="Projects" className="max-h-72 overflow-y-auto">
            {includeAll ? (
              <ListBox.Item id="all" textValue="All projects">
                <Label>All projects</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ) : null}
            <ListBox.Item id="none" textValue="No project No client">
              <div className="flex min-w-0 flex-col">
                <Label>No project</Label>
                <Description>No client</Description>
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>

            {filteredProjects.map((project) => (
              <ListBox.Item
                key={project.id}
                id={project.id}
                textValue={`${project.name} ${clientNameFor(project.clientId)}`}
              >
                <div className="flex min-w-0 flex-col">
                  <Label className="truncate">{project.name}</Label>
                  <Description className="truncate">{clientNameFor(project.clientId)}</Description>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}

            {query.trim() && filteredProjects.length === 0 ? (
              <ListBox.Item id="no-results" isDisabled textValue="No projects found">
                <Description>No projects found</Description>
              </ListBox.Item>
            ) : null}
          </ListBox>
        </div>
      </Select.Popover>
    </Select>
  );
}
