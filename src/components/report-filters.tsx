import {
  Button,
  Checkbox,
  Description,
  I18nProvider,
  Input,
  Label,
  ListBox,
  Popover,
  RangeCalendar,
  Select,
  TextField,
} from "@heroui/react";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Selection } from "@react-types/shared";
import { CalendarDate } from "@internationalized/date";
import type { RangeValue } from "@react-types/shared";
import { useI18n } from "@/lib/i18n";
import {
  formatReportPeriod,
  getReportPeriodRange,
  normalizeSearch,
  reportPeriodPresets,
  type DateRange,
  type ReportPeriodPreset,
} from "@/lib/format";
import type { Client, Member, Project } from "@/lib/mock-data";

export type ReportFilterKey =
  "member" | "client" | "project" | "task" | "description" | "billability";

export type ReportFilterValues = {
  memberIds: string[];
  clientIds: string[];
  projectIds: string[];
  task: string;
  description: string;
  billability: "all" | "billable" | "internal";
};

export type ReportFilterOption = { id: string; label: string; description?: string };

const filterLabels: Record<ReportFilterKey, string> = {
  member: "Team",
  client: "Client",
  project: "Project",
  task: "Task",
  description: "Description",
  billability: "Billability",
};

const defaultVisibleFilters: ReportFilterKey[] = [
  "member",
  "client",
  "project",
  "task",
  "billability",
];

function toCalendarDate(value: string): CalendarDate | null {
  const parts = value.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    ![year, month, day].every((part) => Number.isInteger(part))
  ) {
    return null;
  }
  try {
    return new CalendarDate(year, month, day);
  } catch {
    return null;
  }
}

function toRangeValue(range: DateRange): RangeValue<CalendarDate> | null {
  const start = toCalendarDate(range.startDate);
  const end = toCalendarDate(range.endDate);
  return start && end ? { start, end } : null;
}

function fromRangeValue(value: RangeValue<CalendarDate>): DateRange | null {
  if (!value?.start || !value.end) return null;
  const first = value.start.toString();
  const second = value.end.toString();
  return first <= second
    ? { startDate: first, endDate: second }
    : { startDate: second, endDate: first };
}

function selectedLabel(options: ReportFilterOption[], values: string[], empty: string): string {
  if (values.length === 0) return empty;
  if (values.length === 1) return options.find((option) => option.id === values[0])?.label ?? empty;
  return `${values.length} selected`;
}

function ReportMultiSelect({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: ReportFilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const filteredOptions = useMemo(
    () =>
      normalizedQuery
        ? options.filter((option) =>
            normalizeSearch(`${option.label} ${option.description ?? ""}`).includes(
              normalizedQuery,
            ),
          )
        : options,
    [normalizedQuery, options],
  );

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger>
        <Button
          variant="ghost"
          aria-label={t("{label} filter", { label })}
          className="flex h-9 min-w-32 max-w-48 items-center justify-between gap-2 px-3 text-sm text-foreground"
        >
          <span className="truncate">{selectedLabel(options, values, label)}</span>
          <ChevronRight className="size-4 shrink-0 rotate-90 text-muted" />
        </Button>
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="w-64 max-w-[calc(100vw-1rem)] p-2">
        <Popover.Dialog>
          <div className="flex flex-col gap-2">
            <TextField
              name={`report-${label.toLowerCase()}-search`}
              value={query}
              onChange={setQuery}
            >
              <Label className="sr-only">
                {t("Search {label} options", { label: label.toLowerCase() })}
              </Label>
              <Input placeholder={t("Search {label}...", { label: label.toLowerCase() })} />
            </TextField>
            <ListBox
              aria-label={t("{label} options", { label })}
              selectionMode="multiple"
              selectedKeys={new Set(values)}
              onSelectionChange={(keys: Selection) => {
                onChange(
                  keys === "all" ? options.map((option) => option.id) : [...keys].map(String),
                );
              }}
              className="max-h-64 overflow-y-auto"
            >
              {filteredOptions.map((option) => (
                <ListBox.Item
                  key={option.id}
                  id={option.id}
                  textValue={`${option.label} ${option.description ?? ""}`}
                >
                  <div className="flex min-w-0 flex-col">
                    <Label className="truncate">{option.label}</Label>
                    {option.description ? (
                      <Description className="truncate">{option.description}</Description>
                    ) : null}
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
              {filteredOptions.length === 0 ? (
                <ListBox.Item id="no-results" isDisabled textValue={t("No results")}>
                  <Description>{t("No results")}</Description>
                </ListBox.Item>
              ) : null}
            </ListBox>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function ReportSingleSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReportFilterOption[];
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Popover>
      <Popover.Trigger>
        <Button
          variant="ghost"
          aria-label={t("{label} filter", { label })}
          className="flex h-9 min-w-32 max-w-44 items-center justify-between gap-2 px-3 text-sm text-foreground"
        >
          <span className="truncate">
            {options.find((option) => option.id === value)?.label ?? label}
          </span>
          <ChevronRight className="size-4 shrink-0 rotate-90 text-muted" />
        </Button>
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="w-48 max-w-[calc(100vw-1rem)] p-1">
        <Popover.Dialog>
          <ListBox aria-label={t("{label} options", { label })} selectedKeys={new Set([value])}>
            {options.map((option) => (
              <ListBox.Item
                key={option.id}
                id={option.id}
                textValue={option.label}
                onAction={() => onChange(option.id)}
              >
                <Label>{option.label}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function ReportPeriodPicker({
  preset,
  range,
  today,
  weekStartsOn,
  onChange,
}: {
  preset: ReportPeriodPreset;
  range: DateRange;
  today: string;
  weekStartsOn: 0 | 1;
  onChange: (preset: ReportPeriodPreset, range: DateRange) => void;
}) {
  const { locale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [calendarValue, setCalendarValue] = useState<RangeValue<CalendarDate> | null>(() =>
    toRangeValue(range),
  );
  const [isCompactCalendar, setIsCompactCalendar] = useState(false);
  const [isShortViewport, setIsShortViewport] = useState(false);

  useEffect(() => {
    const compactMediaQuery = window.matchMedia("(max-width: 639px)");
    const shortMediaQuery = window.matchMedia("(max-height: 40rem)");
    const updateCalendarLayout = () => {
      setIsCompactCalendar(compactMediaQuery.matches || shortMediaQuery.matches);
      setIsShortViewport(shortMediaQuery.matches);
    };

    updateCalendarLayout();
    compactMediaQuery.addEventListener("change", updateCalendarLayout);
    shortMediaQuery.addEventListener("change", updateCalendarLayout);

    return () => {
      compactMediaQuery.removeEventListener("change", updateCalendarLayout);
      shortMediaQuery.removeEventListener("change", updateCalendarLayout);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) setCalendarValue(toRangeValue(range));
  }, [isOpen, range]);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger>
        <Button
          variant="ghost"
          aria-label={t("Date range: {range}", { range: formatReportPeriod(range, locale) })}
          className="flex h-10 min-w-56 max-w-full items-center gap-2 px-3 text-sm font-medium text-foreground"
        >
          <CalendarDays className="size-4 shrink-0 text-muted" />
          <span className="truncate">{formatReportPeriod(range, locale)}</span>
          <ChevronRight className="ml-auto size-4 shrink-0 rotate-90 text-muted" />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        placement={isShortViewport ? "top start" : "bottom start"}
        shouldFlip
        containerPadding={12}
        offset={8}
        className="calendar-popover-content w-[min(44rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-visible p-0"
      >
        <Popover.Dialog>
          <div className="flex min-w-0 flex-col sm:flex-row">
            <div className="hidden w-44 shrink-0 flex-col border-b border-separator p-2 sm:flex sm:border-r sm:border-b-0">
              <p className="px-2 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
                {t("Date range")}
              </p>
              {reportPeriodPresets.map((option) => (
                <Button
                  key={option.id}
                  variant={preset === option.id ? "secondary" : "ghost"}
                  className="justify-start rounded-lg px-2.5 py-2 text-sm"
                  onPress={() => {
                    if (option.id === "custom") return;
                    onChange(option.id, getReportPeriodRange(option.id, today, weekStartsOn));
                    setIsOpen(false);
                  }}
                >
                  {t(option.label)}
                </Button>
              ))}
            </div>
            <div className="border-b border-separator p-0 sm:hidden">
              <Select
                aria-label={t("Date range preset")}
                fullWidth
                value={preset}
                onChange={(nextPreset) => {
                  if (!nextPreset || nextPreset === "custom") return;
                  onChange(
                    String(nextPreset) as ReportPeriodPreset,
                    getReportPeriodRange(
                      String(nextPreset) as ReportPeriodPreset,
                      today,
                      weekStartsOn,
                    ),
                  );
                  setIsOpen(false);
                }}
              >
                <Select.Trigger className="h-9 min-h-9">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="w-[var(--trigger-width)] max-w-[calc(100vw-2rem)]">
                  <ListBox aria-label={t("Date range presets")}>
                    {reportPeriodPresets.map((option) => (
                      <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                        {t(option.label)}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className={isCompactCalendar ? "min-w-0 p-1" : "min-w-0 p-3"}>
              <I18nProvider locale={locale}>
                <RangeCalendar
                  aria-label={t("Choose report date range")}
                  firstDayOfWeek={weekStartsOn === 0 ? "sun" : "mon"}
                  value={calendarValue}
                  onChange={(nextValue) => {
                    setCalendarValue(nextValue);
                    const nextRange = fromRangeValue(nextValue);
                    if (nextRange) {
                      onChange("custom", nextRange);
                      setIsOpen(false);
                    }
                  }}
                  visibleDuration={{ months: isCompactCalendar ? 1 : 2 }}
                  className={
                    isCompactCalendar
                      ? "calendar-no-scroll report-calendar-compact max-w-full p-0"
                      : "calendar-no-scroll w-full max-w-full p-1"
                  }
                >
                  <RangeCalendar.Header className="flex items-center justify-between gap-2">
                    <RangeCalendar.NavButton slot="previous" aria-label={t("Previous month")}>
                      <ChevronLeft className="size-4" />
                    </RangeCalendar.NavButton>
                    <RangeCalendar.Heading className="text-sm font-medium" />
                    <RangeCalendar.NavButton slot="next" aria-label={t("Next month")}>
                      <ChevronRight className="size-4" />
                    </RangeCalendar.NavButton>
                  </RangeCalendar.Header>
                  <RangeCalendar.Grid className="mt-2 w-full max-w-full">
                    <RangeCalendar.GridHeader>
                      {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                    </RangeCalendar.GridHeader>
                    <RangeCalendar.GridBody>
                      {(date) => <RangeCalendar.Cell date={date} />}
                    </RangeCalendar.GridBody>
                  </RangeCalendar.Grid>
                  {!isCompactCalendar ? (
                    <RangeCalendar.Grid offset={{ months: 1 }} className="mt-3 w-full max-w-full">
                      <RangeCalendar.GridHeader>
                        {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                      </RangeCalendar.GridHeader>
                      <RangeCalendar.GridBody>
                        {(date) => <RangeCalendar.Cell date={date} />}
                      </RangeCalendar.GridBody>
                    </RangeCalendar.Grid>
                  ) : null}
                </RangeCalendar>
              </I18nProvider>
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

export function ReportFiltersBar({
  preset,
  range,
  today,
  weekStartsOn,
  values,
  visibleFilters,
  members,
  clients,
  projects,
  showTeam,
  weeklyNavigation = false,
  onPeriodChange,
  onPeriodShift,
  onChange,
  onVisibleFiltersChange,
  onClear,
}: {
  preset: ReportPeriodPreset;
  range: DateRange;
  today: string;
  weekStartsOn: 0 | 1;
  values: ReportFilterValues;
  visibleFilters: ReportFilterKey[];
  members: Member[];
  clients: Client[];
  projects: Project[];
  showTeam: boolean;
  weeklyNavigation?: boolean;
  onPeriodChange: (preset: ReportPeriodPreset, range: DateRange) => void;
  onPeriodShift?: (direction: -1 | 1) => void;
  onChange: (patch: Partial<ReportFilterValues>) => void;
  onVisibleFiltersChange: (filters: ReportFilterKey[]) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const visible = showTeam ? visibleFilters : visibleFilters.filter((key) => key !== "member");
  const memberOptions = members
    .filter((member) => member.status === "active")
    .map((member) => ({ id: member.id, label: member.name, description: member.email }));
  const clientOptions = clients.map((client) => ({
    id: client.id,
    label: client.name,
    description: client.contact,
  }));
  const projectOptions = [
    { id: "none", label: "No project", description: "No client" },
    ...projects.map((project) => ({
      id: project.id,
      label: project.name,
      description:
        clients.find((client) => client.id === project.clientId)?.name ?? t("Unknown client"),
    })),
  ];
  const filterOptions = (Object.keys(filterLabels) as ReportFilterKey[]).filter(
    (key) => showTeam || key !== "member",
  );

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          {weeklyNavigation ? (
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label={t("Previous {unit}", { unit: t("week") })}
              onPress={() => onPeriodShift?.(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
          ) : null}
          <ReportPeriodPicker
            preset={preset}
            range={range}
            today={today}
            weekStartsOn={weekStartsOn}
            onChange={onPeriodChange}
          />
          {weeklyNavigation ? (
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label={t("Next {unit}", { unit: t("week") })}
              onPress={() => onPeriodShift?.(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onPress={onClear}>
          <RotateCcw className="size-4" />
          {t("Clear filters")}
        </Button>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Popover>
          <Popover.Trigger>
            <Button
              variant="ghost"
              aria-label={t("Choose report filters")}
              className="flex h-9 shrink-0 items-center gap-2 px-3 text-sm font-medium text-foreground"
            >
              <Filter className="size-4" />
              {t("Filters")}
            </Button>
          </Popover.Trigger>
          <Popover.Content placement="bottom start" className="w-64 max-w-[calc(100vw-1rem)] p-2">
            <Popover.Dialog>
              <p className="px-2 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
                {t("Show filters")}
              </p>
              <div className="space-y-1">
                {filterOptions.map((key) => (
                  <Checkbox
                    key={key}
                    isSelected={visibleFilters.includes(key)}
                    onChange={(selected) => {
                      const next = selected
                        ? [...visibleFilters, key]
                        : visibleFilters.filter((current) => current !== key);
                      onVisibleFiltersChange(next);
                    }}
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Label>{t(filterLabels[key])}</Label>
                    </Checkbox.Content>
                  </Checkbox>
                ))}
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>

        {visible.includes("member") && showTeam ? (
          <ReportMultiSelect
            label={t("Team")}
            options={memberOptions}
            values={values.memberIds}
            onChange={(memberIds) => onChange({ memberIds })}
          />
        ) : null}
        {visible.includes("client") ? (
          <ReportMultiSelect
            label={t("Client")}
            options={clientOptions}
            values={values.clientIds}
            onChange={(clientIds) => onChange({ clientIds })}
          />
        ) : null}
        {visible.includes("project") ? (
          <ReportMultiSelect
            label={t("Project")}
            options={projectOptions}
            values={values.projectIds}
            onChange={(projectIds) => onChange({ projectIds })}
          />
        ) : null}
        {visible.includes("task") ? (
          <TextField
            className="w-44"
            name="report-task-filter"
            value={values.task}
            onChange={(task) => onChange({ task })}
          >
            <Label className="sr-only">{t("Task filter")}</Label>
            <Input placeholder={t("Task")} />
          </TextField>
        ) : null}
        {visible.includes("description") ? (
          <TextField
            className="w-48"
            name="report-description-filter"
            value={values.description}
            onChange={(description) => onChange({ description })}
          >
            <Label className="sr-only">{t("Description filter")}</Label>
            <Input placeholder={t("Description")} />
          </TextField>
        ) : null}
        {visible.includes("billability") ? (
          <ReportSingleSelect
            label={t("Billability")}
            value={values.billability}
            options={[
              { id: "all", label: t("All billability") },
              { id: "billable", label: t("Billable") },
              { id: "internal", label: t("Internal") },
            ]}
            onChange={(billability) =>
              onChange({ billability: billability as ReportFilterValues["billability"] })
            }
          />
        ) : null}
        {visible.length === 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => onVisibleFiltersChange(defaultVisibleFilters)}
          >
            {t("Add filters")}
          </Button>
        ) : null}
        {values.memberIds.length + values.clientIds.length + values.projectIds.length > 0 ||
        values.task ||
        values.description ||
        values.billability !== "all" ? (
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            aria-label={t("Clear active report filters")}
            onPress={onClear}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
