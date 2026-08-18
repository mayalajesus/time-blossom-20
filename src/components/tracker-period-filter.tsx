import { ChevronLeft, ChevronRight } from "lucide-react";
import { I18nProvider, Popover, RangeCalendar } from "@heroui/react";
import { CalendarDate } from "@internationalized/date";
import type { RangeValue } from "@react-types/shared";
import { useEffect, useState } from "react";
import { getISOWeek } from "date-fns";
import {
  formatDateRange,
  formatCompactDateRange,
  formatTrackerPeriodLabel,
  formatWeekRange,
  getWeekBounds,
  parseDateOnly,
  type TrackerPeriod,
} from "@/lib/format";

function toCalendarDate(value: string): CalendarDate | null {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;

  try {
    return new CalendarDate(year, month, day);
  } catch {
    return null;
  }
}

function toCalendarRange(period: TrackerPeriod): RangeValue<CalendarDate> | null {
  const start = toCalendarDate(period.startDate);
  const end = toCalendarDate(period.endDate);
  return start && end ? { start, end } : null;
}

function periodFromRange(startDate: string, endDate: string, weekStartsOn: 0 | 1): TrackerPeriod {
  if (startDate === endDate) return { unit: "day", startDate, endDate };

  const selectedWeek = getWeekBounds(startDate, weekStartsOn);
  if (selectedWeek.start === startDate && selectedWeek.end === endDate) {
    return { unit: "week", startDate, endDate };
  }

  return { unit: "custom", startDate, endDate };
}

export function TrackerPeriodFilter({
  period,
  today,
  weekStartsOn,
  onChange,
}: {
  period: TrackerPeriod;
  today: string;
  weekStartsOn: 0 | 1;
  onChange: (period: TrackerPeriod) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [rangeValue, setRangeValue] = useState<RangeValue<CalendarDate> | null>(() =>
    toCalendarRange(period),
  );
  const label = formatTrackerPeriodLabel(period, today, weekStartsOn);
  const displayLabel =
    period.unit === "custom"
      ? formatCompactDateRange(period.startDate, period.endDate)
      : period.unit === "week"
        ? period.startDate === getWeekBounds(today, weekStartsOn).start
          ? label
          : formatCompactDateRange(period.startDate, period.endDate)
        : label;
  const rangeLabel =
    period.unit === "week"
      ? formatWeekRange(period.startDate, period.endDate)
      : formatDateRange(period.startDate, period.endDate);
  const periodMeta =
    period.unit === "week"
      ? `W${getISOWeek(parseDateOnly(period.startDate))}`
      : period.unit === "custom"
        ? ""
        : rangeLabel;

  useEffect(() => {
    if (!isOpen) setRangeValue(toCalendarRange(period));
  }, [isOpen, period]);

  const handleRangeChange = (nextRange: RangeValue<CalendarDate>) => {
    setRangeValue(nextRange);
    if (!nextRange?.start || !nextRange.end) return;

    const firstDate = nextRange.start.toString();
    const secondDate = nextRange.end.toString();
    const startDate = firstDate <= secondDate ? firstDate : secondDate;
    const endDate = firstDate <= secondDate ? secondDate : firstDate;
    onChange(periodFromRange(startDate, endDate, weekStartsOn));
    setIsOpen(false);
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger
        aria-label={`Open period calendar: ${label}`}
        className="flex h-8 w-[11rem] min-w-[11rem] max-w-[11rem] shrink-0 items-center justify-center rounded-lg px-2 text-center outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex min-w-0 max-w-full items-center justify-center gap-1 whitespace-nowrap text-sm font-medium text-foreground">
          <span className="min-w-0 truncate">{displayLabel}</span>
          {periodMeta && (
            <span
              className={
                period.unit === "week"
                  ? "shrink-0 font-normal text-muted"
                  : "min-w-0 truncate font-normal text-muted"
              }
            >
              • {periodMeta}
            </span>
          )}
        </span>
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="max-w-[calc(100vw-2rem)] p-2">
        <Popover.Dialog>
          <I18nProvider locale="en-US">
            <RangeCalendar
              aria-label="Choose tracking date range"
              firstDayOfWeek="mon"
              value={rangeValue}
              onChange={handleRangeChange}
              className="p-2"
            >
              <RangeCalendar.Header className="flex items-center justify-between gap-2">
                <RangeCalendar.NavButton slot="previous" aria-label="Previous month">
                  <ChevronLeft className="size-4" />
                </RangeCalendar.NavButton>
                <RangeCalendar.Heading className="text-sm font-medium" />
                <RangeCalendar.NavButton slot="next" aria-label="Next month">
                  <ChevronRight className="size-4" />
                </RangeCalendar.NavButton>
              </RangeCalendar.Header>
              <RangeCalendar.Grid className="mt-2">
                <RangeCalendar.GridHeader>
                  {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                </RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>
                  {(date) => <RangeCalendar.Cell date={date} />}
                </RangeCalendar.GridBody>
              </RangeCalendar.Grid>
            </RangeCalendar>
          </I18nProvider>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
