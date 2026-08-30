import { Calendar, ChevronLeft, ChevronRight } from "@gravity-ui/icons";
import { Button, I18nProvider, Popover, RangeCalendar } from "@heroui/react";
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
import { useI18n } from "@/lib/i18n";

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
  const { locale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isShortViewport, setIsShortViewport] = useState(false);
  const [rangeValue, setRangeValue] = useState<RangeValue<CalendarDate> | null>(() =>
    toCalendarRange(period),
  );
  const label = formatTrackerPeriodLabel(period, today, weekStartsOn, locale);
  const translatedLabel = t(label);
  const displayLabel =
    period.unit === "custom"
      ? formatCompactDateRange(period.startDate, period.endDate, locale)
      : period.unit === "week"
        ? period.startDate === getWeekBounds(today, weekStartsOn).start
          ? translatedLabel
          : formatCompactDateRange(period.startDate, period.endDate, locale)
        : translatedLabel;
  const rangeLabel =
    period.unit === "week"
      ? formatWeekRange(period.startDate, period.endDate, locale)
      : formatDateRange(period.startDate, period.endDate, locale);
  const periodMeta =
    period.unit === "week"
      ? `W${getISOWeek(parseDateOnly(period.startDate))}`
      : period.unit === "custom"
        ? ""
        : rangeLabel;

  useEffect(() => {
    if (!isOpen) setRangeValue(toCalendarRange(period));
  }, [isOpen, period]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-height: 40rem)");
    const updatePlacement = () => setIsShortViewport(mediaQuery.matches);

    updatePlacement();
    mediaQuery.addEventListener("change", updatePlacement);

    return () => mediaQuery.removeEventListener("change", updatePlacement);
  }, []);

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
      <Popover.Trigger>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t("Open period calendar: {label}", { label: translatedLabel })}
          className="flex h-9 w-[11rem] min-w-[11rem] max-w-[11rem] shrink-0 items-center justify-start gap-2 px-3 text-left"
        >
          <Calendar aria-hidden="true" className="size-4 shrink-0" />
          <span className="flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap">
            <span className="min-w-0 truncate">{displayLabel}</span>
            {periodMeta && (
              <span className={period.unit === "week" ? "shrink-0" : "min-w-0 truncate"}>
                • {periodMeta}
              </span>
            )}
          </span>
        </Button>
      </Popover.Trigger>
      <Popover.Content
        placement={isShortViewport ? "top start" : "bottom start"}
        shouldFlip
        containerPadding={12}
        offset={8}
        className="w-[min(16rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-visible p-0"
      >
        <Popover.Dialog>
          <I18nProvider locale={locale}>
            <RangeCalendar
              aria-label={t("Choose tracking date range")}
              firstDayOfWeek={weekStartsOn === 0 ? "sun" : "mon"}
              value={rangeValue}
              onChange={handleRangeChange}
              className="w-full max-w-full p-3"
            >
              <RangeCalendar.Header className="flex items-center justify-between gap-2">
                <RangeCalendar.NavButton slot="previous" aria-label={t("Previous month")}>
                  <ChevronLeft className="size-4" />
                </RangeCalendar.NavButton>
                <RangeCalendar.Heading />
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
            </RangeCalendar>
          </I18nProvider>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
