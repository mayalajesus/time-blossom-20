import {
  Button,
  ButtonGroup,
  Description,
  DateField,
  DateRangePicker,
  I18nProvider,
  Input,
  Label,
  ListBox,
  RangeCalendar,
  Select,
  TextField,
  Toolbar,
} from "@heroui/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
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

export type ReportFilterKey = "member" | "client" | "project" | "description" | "billability";

export type ReportFilterValues = {
  memberIds: string[];
  clientIds: string[];
  projectIds: string[];
  description: string;
  billability: "all" | "billable" | "internal";
};

export type ReportFilterOption = { id: string; label: string; description?: string };

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

function fromRangeValue(value: RangeValue<CalendarDate> | null): DateRange | null {
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
  const searchRef = useRef<HTMLInputElement | null>(null);
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
    if (!isOpen) {
      setQuery("");
      return;
    }

    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  return (
    <Select<object, "multiple">
      aria-label={t("{label} filter", { label })}
      selectionMode="multiple"
      value={values}
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        setIsOpen(nextIsOpen);
        if (!nextIsOpen) setQuery("");
      }}
      onChange={(keys) => {
        const visibleIds = new Set(filteredOptions.map((option) => option.id));
        const selectedVisibleIds = keys.map(String);
        onChange(values.filter((value) => !visibleIds.has(value)).concat(selectedVisibleIds));
      }}
    >
      <Select.Trigger>
        <Select.Value>{() => selectedLabel(options, values, label)}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <div className="flex min-w-0 flex-col gap-2">
          <TextField
            name={`report-${label.toLowerCase()}-search`}
            value={query}
            onChange={setQuery}
          >
            <Label className="sr-only">
              {t("Search {label} options", { label: label.toLowerCase() })}
            </Label>
            <Input
              ref={searchRef}
              placeholder={t("Search {label}...", { label: label.toLowerCase() })}
              onKeyDown={(event) => {
                if (event.key !== "Escape") event.stopPropagation();
              }}
            />
          </TextField>
          <div className="max-h-64 overflow-y-auto">
            <ListBox aria-label={t("{label} options", { label })}>
              {filteredOptions.map((option) => (
                <ListBox.Item
                  key={option.id}
                  id={option.id}
                  textValue={`${option.label} ${option.description ?? ""}`}
                >
                  <div className="flex min-w-0 flex-col">
                    <Label>{option.label}</Label>
                    {option.description ? <Description>{option.description}</Description> : null}
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
        </div>
      </Select.Popover>
    </Select>
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
    <Select
      aria-label={t("{label} filter", { label })}
      value={value}
      onChange={(key) => {
        if (key !== null) onChange(String(key));
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label={t("{label} options", { label })}>
          {options.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              <Label>{option.label}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) setCalendarValue(toRangeValue(range));
  }, [isOpen, range]);

  return (
    <I18nProvider locale={locale}>
      <DateRangePicker
        aria-label={t("Date range: {range}", { range: formatReportPeriod(range, locale) })}
        value={calendarValue}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onChange={(nextValue) => {
          setCalendarValue(nextValue);
          const nextRange = fromRangeValue(nextValue);
          if (nextRange) {
            onChange("custom", nextRange);
            setIsOpen(false);
          }
        }}
      >
        <Label className="sr-only">{t("Report period")}</Label>
        <DateField.Group aria-label={t("Selected report period")}>
          <DateField.Input slot="start">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateRangePicker.RangeSeparator>–</DateRangePicker.RangeSeparator>
          <DateField.Input slot="end">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <DateRangePicker.Trigger
              ref={triggerRef}
              aria-label={t("Open {label} calendar", { label: t("Date range") })}
            >
              <DateRangePicker.TriggerIndicator />
            </DateRangePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>

        <DateRangePicker.Popover
          placement="bottom start"
          triggerRef={triggerRef}
          shouldFlip
          containerPadding={12}
          offset={8}
        >
          <div className="flex min-w-0 flex-col sm:flex-row">
            <div className="hidden w-36 shrink-0 flex-col p-2 sm:flex">
              <p className="px-2 py-2">{t("Date range")}</p>
              {reportPeriodPresets.map((option) => (
                <Button
                  key={option.id}
                  size="sm"
                  variant={preset === option.id ? "secondary" : "ghost"}
                  onPress={() => {
                    if (option.id === "custom") return;
                    const nextRange = getReportPeriodRange(option.id, today, weekStartsOn);
                    setCalendarValue(toRangeValue(nextRange));
                    onChange(option.id, nextRange);
                    setIsOpen(false);
                  }}
                >
                  {t(option.label)}
                </Button>
              ))}
            </div>
            <div className="p-0 sm:hidden">
              <Select
                aria-label={t("Date range preset")}
                fullWidth
                value={preset}
                onChange={(nextPreset) => {
                  if (!nextPreset || nextPreset === "custom") return;
                  const nextRange = getReportPeriodRange(
                    String(nextPreset) as ReportPeriodPreset,
                    today,
                    weekStartsOn,
                  );
                  setCalendarValue(toRangeValue(nextRange));
                  onChange(String(nextPreset) as ReportPeriodPreset, nextRange);
                  setIsOpen(false);
                }}
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
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
            <div className="min-w-0 flex-1 p-3 sm:w-64 sm:flex-none">
              <RangeCalendar
                aria-label={t("Choose report date range")}
                firstDayOfWeek={weekStartsOn === 0 ? "sun" : "mon"}
                visibleDuration={{ months: 1 }}
              >
                <RangeCalendar.Header>
                  <RangeCalendar.NavButton slot="previous" aria-label={t("Previous month")}>
                    <ChevronLeft className="size-4" />
                  </RangeCalendar.NavButton>
                  <RangeCalendar.Heading />
                  <RangeCalendar.NavButton slot="next" aria-label={t("Next month")}>
                    <ChevronRight className="size-4" />
                  </RangeCalendar.NavButton>
                </RangeCalendar.Header>
                <RangeCalendar.Grid>
                  <RangeCalendar.GridHeader>
                    {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                  </RangeCalendar.GridHeader>
                  <RangeCalendar.GridBody>
                    {(date) => <RangeCalendar.Cell date={date} />}
                  </RangeCalendar.GridBody>
                </RangeCalendar.Grid>
              </RangeCalendar>
            </div>
          </div>
        </DateRangePicker.Popover>
      </DateRangePicker>
    </I18nProvider>
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
  onClear: () => void;
}) {
  const { t } = useI18n();
  const visible = showTeam ? visibleFilters : visibleFilters.filter((key) => key !== "member");
  const memberOptions = useMemo(
    () =>
      members
        .filter((member) => member.status === "active")
        .map((member) => ({ id: member.id, label: member.name, description: member.email })),
    [members],
  );
  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        id: client.id,
        label: client.name,
        description: client.contact,
      })),
    [clients],
  );
  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients],
  );
  const projectOptions = useMemo(
    () => [
      { id: "none", label: "No project", description: "No client" },
      ...projects.map((project) => ({
        id: project.id,
        label: project.name,
        description: clientNameById.get(project.clientId) ?? t("Unknown client"),
      })),
    ],
    [clientNameById, projects, t],
  );
  const activeFilterCount = [
    values.memberIds.length > 0,
    values.clientIds.length > 0,
    values.projectIds.length > 0,
    values.description.trim().length > 0,
    values.billability !== "all",
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;
  const dataFilterControls: ReactElement[] = [];

  if (visible.includes("member") && showTeam) {
    dataFilterControls.push(
      <ReportMultiSelect
        key="member"
        label={t("Team")}
        options={memberOptions}
        values={values.memberIds}
        onChange={(memberIds) => onChange({ memberIds })}
      />,
    );
  }
  if (visible.includes("client")) {
    dataFilterControls.push(
      <ReportMultiSelect
        key="client"
        label={t("Client")}
        options={clientOptions}
        values={values.clientIds}
        onChange={(clientIds) => onChange({ clientIds })}
      />,
    );
  }
  if (visible.includes("project")) {
    dataFilterControls.push(
      <ReportMultiSelect
        key="project"
        label={t("Project")}
        options={projectOptions}
        values={values.projectIds}
        onChange={(projectIds) => onChange({ projectIds })}
      />,
    );
  }
  if (visible.includes("billability")) {
    dataFilterControls.push(
      <ReportSingleSelect
        key="billability"
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
      />,
    );
  }

  return (
    <Toolbar
      orientation="horizontal"
      isAttached
      aria-label={t("Report filters")}
      className="w-full max-w-full flex-wrap"
    >
      {weeklyNavigation ? (
        <ButtonGroup variant="tertiary" size="sm" aria-label={t("Report period navigation")}>
          <Button
            isIconOnly
            aria-label={t("Previous {unit}", { unit: t("week") })}
            onPress={() => onPeriodShift?.(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            isIconOnly
            aria-label={t("Next {unit}", { unit: t("week") })}
            onPress={() => onPeriodShift?.(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </ButtonGroup>
      ) : null}
      <ReportPeriodPicker
        preset={preset}
        range={range}
        today={today}
        weekStartsOn={weekStartsOn}
        onChange={onPeriodChange}
      />

      {dataFilterControls}
      {visible.includes("description") ? (
        <TextField
          name="report-description-filter"
          value={values.description}
          onChange={(description) => onChange({ description })}
        >
          <Label className="sr-only">{t("Description filter")}</Label>
          <Input placeholder={t("Description")} />
        </TextField>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label={t("Clear filters")}
        isDisabled={!hasActiveFilters}
        onPress={onClear}
      >
        <RotateCcw className="size-4" />
      </Button>
    </Toolbar>
  );
}
