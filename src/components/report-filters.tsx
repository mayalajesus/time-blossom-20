import {
  Autocomplete,
  Button,
  ButtonGroup,
  DateField,
  DateRangePicker,
  Dropdown,
  EmptyState,
  I18nProvider,
  Input,
  InputGroup,
  Label,
  ListBox,
  RangeCalendar,
  SearchField,
  TextField,
  Toolbar,
  Typography,
  useFilter,
} from "@heroui/react";
import {
  ArrowRotateLeft,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollar,
  Folder,
  Magnifier,
  Person,
  Persons,
} from "@gravity-ui/icons";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { CalendarDate } from "@internationalized/date";
import type { RangeValue } from "@react-types/shared";
import { useI18n } from "@/lib/i18n";
import {
  formatReportPeriod,
  getReportPeriodRange,
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

const reportFilterIconClassName = "size-4 shrink-0";

function ReportFilterValue({ children }: { children: string }) {
  return (
    <Typography
      slot="description"
      type="body-sm"
      color="default"
      weight="normal"
      truncate
      className="min-w-0"
    >
      {children}
    </Typography>
  );
}

function ReportFilterIcon({ children }: { children: ReactNode }) {
  return (
    <Typography
      slot="description"
      type="body-sm"
      color="muted"
      weight="normal"
      className="flex size-4 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      {children}
    </Typography>
  );
}

function ReportPeriodNavigation({
  navigationLabel,
  previousLabel,
  nextLabel,
  onPeriodShift,
}: {
  navigationLabel: string;
  previousLabel: string;
  nextLabel: string;
  onPeriodShift?: (direction: -1 | 1) => void;
}) {
  return (
    <ButtonGroup variant="tertiary" size="sm" aria-label={navigationLabel}>
      <Button isIconOnly aria-label={previousLabel} onPress={() => onPeriodShift?.(-1)}>
        <ChevronLeft aria-hidden="true" className={reportFilterIconClassName} />
      </Button>
      <Button isIconOnly aria-label={nextLabel} onPress={() => onPeriodShift?.(1)}>
        <ChevronRight aria-hidden="true" className={reportFilterIconClassName} />
      </Button>
    </ButtonGroup>
  );
}

function ReportFilterActions({
  hasActiveFilters,
  clearLabel,
  onClear,
}: {
  hasActiveFilters: boolean;
  clearLabel: string;
  onClear: () => void;
}) {
  return (
    <Button
      variant="tertiary"
      size="sm"
      isIconOnly
      className="shrink-0"
      aria-label={clearLabel}
      isDisabled={!hasActiveFilters}
      onPress={onClear}
    >
      <ReportFilterIcon>
        <ArrowRotateLeft aria-hidden="true" className={reportFilterIconClassName} />
      </ReportFilterIcon>
    </Button>
  );
}

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
  icon,
  options,
  values,
  onChange,
  className,
}: {
  label: string;
  icon: ReactNode;
  options: ReportFilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <Autocomplete<ReportFilterOption, "multiple">
      variant="secondary"
      {...(className ? { className } : {})}
      aria-label={t("{label} filter", { label })}
      selectionMode="multiple"
      value={values}
      onChange={(keys) => {
        const selectedVisibleIds = keys.map(String);
        onChange(selectedVisibleIds);
      }}
    >
      <Autocomplete.Trigger className="h-9 w-full min-w-0 items-center gap-2">
        <ReportFilterIcon>{icon}</ReportFilterIcon>
        <Autocomplete.Value className="min-w-0 truncate">
          {() => <ReportFilterValue>{selectedLabel(options, values, label)}</ReportFilterValue>}
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover className="w-64 max-w-[calc(100vw-2rem)] min-w-0">
        <Autocomplete.Filter filter={contains}>
          <SearchField
            autoFocus
            aria-label={t("Search {label} options", { label: label.toLowerCase() })}
            name={`report-${label.toLowerCase()}-search`}
            variant="secondary"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder={t("Search {label}...", { label: label.toLowerCase() })}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox
            aria-label={t("{label} options", { label })}
            renderEmptyState={() => <EmptyState>{t("No results")}</EmptyState>}
          >
            {options.map((option) => (
              <ListBox.Item
                key={option.id}
                id={option.id}
                textValue={`${option.label} ${option.description ?? ""}`}
              >
                {option.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

function ReportSingleSelect({
  label,
  icon,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  options: ReportFilterOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <Dropdown>
      <ButtonGroup
        variant="secondary"
        size="sm"
        className={className ? `min-w-0 ${className}` : "min-w-0"}
      >
        <Button
          type="button"
          aria-label={t("{label} filter", { label })}
          className="h-9 min-w-0 flex-1 justify-start gap-2"
        >
          <ReportFilterIcon>{icon}</ReportFilterIcon>
          <ReportFilterValue>
            {options.find((option) => option.id === value)?.label ?? label}
          </ReportFilterValue>
        </Button>
        <Dropdown.Trigger
          aria-label={t("Open {label}", { label })}
          className="h-9 w-9 min-w-9 shrink-0 px-0"
        >
          <ChevronDown aria-hidden="true" className={reportFilterIconClassName} />
        </Dropdown.Trigger>
      </ButtonGroup>
      <Dropdown.Popover>
        <Dropdown.Menu
          aria-label={t("{label} options", { label })}
          selectionMode="single"
          selectedKeys={new Set([value])}
          onAction={(key) => onChange(String(key))}
        >
          {options.map((option) => (
            <Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
              <Label>{option.label}</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function ReportPeriodPicker({
  preset,
  range,
  today,
  weekStartsOn,
  weeklyNavigation = false,
  onChange,
}: {
  preset: ReportPeriodPreset;
  range: DateRange;
  today: string;
  weekStartsOn: 0 | 1;
  weeklyNavigation?: boolean;
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
        className="w-60 min-w-60 shrink-0"
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
        <DateField.Group
          className="h-9 w-full min-w-0"
          variant="secondary"
          aria-label={t("Selected report period")}
        >
          <DateField.Prefix className="pointer-events-auto">
            <DateRangePicker.Trigger
              ref={triggerRef}
              className="h-8 w-8 shrink-0 px-0"
              aria-label={t("Open {label} calendar", { label: t("Date range") })}
            >
              <DateRangePicker.TriggerIndicator className={reportFilterIconClassName} />
            </DateRangePicker.Trigger>
          </DateField.Prefix>
          <DateField.Input slot="start">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateRangePicker.RangeSeparator>–</DateRangePicker.RangeSeparator>
          <DateField.Input slot="end">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
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
              <Typography type="body-xs" color="muted" weight="semibold" className="px-2 py-2">
                {t("Date range")}
              </Typography>
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
              <Dropdown>
                <ButtonGroup variant="secondary" size="sm" className="w-full">
                  <Button
                    type="button"
                    aria-label={t("Date range preset")}
                    className="h-9 min-w-0 flex-1 justify-start"
                  >
                    {t(
                      reportPeriodPresets.find((option) => option.id === preset)?.label ?? "Custom",
                    )}
                  </Button>
                  <Dropdown.Trigger
                    aria-label={t("Choose date range preset")}
                    className="h-9 w-9 min-w-9 shrink-0 px-0"
                  >
                    <ChevronDown aria-hidden="true" className={reportFilterIconClassName} />
                  </Dropdown.Trigger>
                </ButtonGroup>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    aria-label={t("Date range presets")}
                    selectionMode="single"
                    selectedKeys={new Set([preset])}
                    onAction={(key) => {
                      const nextPreset = String(key) as ReportPeriodPreset;
                      if (nextPreset === "custom") return;
                      const nextRange = getReportPeriodRange(nextPreset, today, weekStartsOn);
                      setCalendarValue(toRangeValue(nextRange));
                      onChange(nextPreset, nextRange);
                      setIsOpen(false);
                    }}
                  >
                    {reportPeriodPresets.map((option) => (
                      <Dropdown.Item
                        key={option.id}
                        id={option.id}
                        textValue={option.label}
                        isDisabled={option.id === "custom"}
                      >
                        <Label>{t(option.label)}</Label>
                        <Dropdown.ItemIndicator />
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
            <div className="min-w-0 flex-1 p-3 sm:w-64 sm:flex-none">
              <RangeCalendar
                aria-label={t("Choose report date range")}
                firstDayOfWeek={weekStartsOn === 0 ? "sun" : "mon"}
                visibleDuration={{ months: 1 }}
              >
                <RangeCalendar.Header>
                  <RangeCalendar.NavButton slot="previous" aria-label={t("Previous month")}>
                    <ChevronLeft aria-hidden="true" className={reportFilterIconClassName} />
                  </RangeCalendar.NavButton>
                  <RangeCalendar.Heading />
                  <RangeCalendar.NavButton slot="next" aria-label={t("Next month")}>
                    <ChevronRight aria-hidden="true" className={reportFilterIconClassName} />
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
  const multiSelectClassName = weeklyNavigation ? "w-28 shrink-0" : "w-32 shrink-0";
  const billabilityClassName = weeklyNavigation ? "w-36 shrink-0" : "w-40 shrink-0";

  if (visible.includes("member") && showTeam) {
    dataFilterControls.push(
      <ReportMultiSelect
        key="member"
        label={t("Team")}
        icon={<Persons aria-hidden="true" className={reportFilterIconClassName} />}
        options={memberOptions}
        values={values.memberIds}
        onChange={(memberIds) => onChange({ memberIds })}
        className={multiSelectClassName}
      />,
    );
  }
  if (visible.includes("client")) {
    dataFilterControls.push(
      <ReportMultiSelect
        key="client"
        label={t("Client")}
        icon={<Person aria-hidden="true" className={reportFilterIconClassName} />}
        options={clientOptions}
        values={values.clientIds}
        onChange={(clientIds) => onChange({ clientIds })}
        className={multiSelectClassName}
      />,
    );
  }
  if (visible.includes("project")) {
    dataFilterControls.push(
      <ReportMultiSelect
        key="project"
        label={t("Project")}
        icon={<Folder aria-hidden="true" className={reportFilterIconClassName} />}
        options={projectOptions}
        values={values.projectIds}
        onChange={(projectIds) => onChange({ projectIds })}
        className={multiSelectClassName}
      />,
    );
  }
  if (visible.includes("billability")) {
    dataFilterControls.push(
      <ReportSingleSelect
        key="billability"
        label={t("Billability")}
        icon={<CircleDollar aria-hidden="true" className={reportFilterIconClassName} />}
        value={values.billability}
        options={[
          { id: "all", label: t("All billability") },
          { id: "billable", label: t("Billable") },
          { id: "internal", label: t("Internal") },
        ]}
        onChange={(billability) =>
          onChange({ billability: billability as ReportFilterValues["billability"] })
        }
        className={billabilityClassName}
      />,
    );
  }

  return (
    <Toolbar
      orientation="horizontal"
      aria-label={t("Report filters")}
      className="w-full max-w-full min-w-0 flex flex-nowrap items-center justify-between gap-3 overflow-visible"
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {weeklyNavigation ? (
          <ReportPeriodNavigation
            navigationLabel={t("Report period navigation")}
            previousLabel={t("Previous {unit}", { unit: t("week") })}
            nextLabel={t("Next {unit}", { unit: t("week") })}
            {...(onPeriodShift ? { onPeriodShift } : {})}
          />
        ) : null}
        <ReportPeriodPicker
          preset={preset}
          range={range}
          today={today}
          weekStartsOn={weekStartsOn}
          weeklyNavigation={weeklyNavigation}
          onChange={onPeriodChange}
        />
      </div>

      <div className="flex w-fit min-w-0 shrink-0 flex-nowrap items-center justify-end gap-2">
        {dataFilterControls.map((control, index) => (
          <Fragment key={`report-filter-${index}`}>{control}</Fragment>
        ))}
        {visible.includes("description") ? (
          <TextField
            className={weeklyNavigation ? "w-36 shrink-0" : "w-40 shrink-0"}
            name="report-description-filter"
            value={values.description}
            onChange={(description) => onChange({ description })}
          >
            <Label className="sr-only">{t("Description filter")}</Label>
            <InputGroup className="min-w-0" variant="primary">
              <InputGroup.Prefix>
                <ReportFilterIcon>
                  <Magnifier aria-hidden="true" className={reportFilterIconClassName} />
                </ReportFilterIcon>
              </InputGroup.Prefix>
              <InputGroup.Input placeholder={t("Description")} />
            </InputGroup>
          </TextField>
        ) : null}
        <ReportFilterActions
          hasActiveFilters={hasActiveFilters}
          clearLabel={t("Clear filters")}
          onClear={onClear}
        />
      </div>
    </Toolbar>
  );
}
