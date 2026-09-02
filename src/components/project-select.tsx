import { Autocomplete } from "@heroui/react/autocomplete";
import { EmptyState } from "@heroui/react/empty-state";
import { ListBox } from "@heroui/react/list-box";
import { SearchField } from "@heroui/react/search-field";
import { useFilter } from "@heroui/react/rac";
import { useMemo, useState } from "react";
import { ProjectLabel } from "@/components/project-color";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export type ProjectSelectValue = "all" | "none" | string;

export interface ProjectSelectProps {
  value: ProjectSelectValue;
  onChange: (value: ProjectSelectValue) => void;
  includeAll?: boolean;
  allowArchivedId?: string | null;
  ariaLabel: string;
  variant?: "primary" | "secondary";
  listClassName?: string;
}

export function ProjectSelect({
  value,
  onChange,
  includeAll = false,
  allowArchivedId = null,
  ariaLabel,
  variant = "secondary",
  listClassName = "max-h-72 overflow-y-auto",
}: ProjectSelectProps) {
  const { projects, clients, canTrackProject } = useStore();
  const { t } = useI18n();
  const { contains } = useFilter({ sensitivity: "base" });
  const [isOpen, setIsOpen] = useState(false);

  const availableProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          (includeAll || canTrackProject(project.id) || project.id === value) &&
          (project.status !== "archived" || includeAll || project.id === allowArchivedId),
      ),
    [allowArchivedId, canTrackProject, includeAll, projects, value],
  );

  const clientNameFor = (clientId: string) =>
    clients.find((client) => client.id === clientId)?.name ?? t("Unknown client");

  return (
    <Autocomplete
      aria-label={ariaLabel}
      data-project-select
      fullWidth
      variant={variant}
      value={value}
      onChange={(key) => onChange(key === null ? "none" : String(key))}
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        setIsOpen(nextIsOpen);
      }}
    >
      <Autocomplete.Trigger className="h-9 w-full min-w-0 items-center gap-2">
        <Autocomplete.Value />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover
        className="w-64 max-w-[calc(100vw-2rem)] min-w-0"
        data-project-select-popover
      >
        <div className="flex flex-col gap-2 p-2">
          <Autocomplete.Filter filter={contains}>
            <SearchField
              autoFocus
              aria-label={t("Search projects")}
              name={`project-search-${ariaLabel.toLowerCase().replace(/\s+/g, "-")}`}
              variant="secondary"
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={`${t("Search projects")}...`} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox
              aria-label={t("Projects")}
              className={listClassName}
              renderEmptyState={() => <EmptyState>{t("No projects found")}</EmptyState>}
            >
              {includeAll ? (
                <ListBox.Item id="all" textValue={t("All projects")}>
                  {t("All projects")}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ) : null}
              <ListBox.Item id="none" textValue={t("No project")}>
                {t("No project")}
                <ListBox.ItemIndicator />
              </ListBox.Item>

              {availableProjects.map((project) => (
                <ListBox.Item
                  key={project.id}
                  id={project.id}
                  textValue={`${project.name} ${clientNameFor(project.clientId)}`}
                >
                  <ProjectLabel project={project} label={project.name} />
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </div>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
