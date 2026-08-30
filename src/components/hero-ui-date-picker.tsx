import { Calendar, DateField, DatePicker, I18nProvider } from "@heroui/react";
import { CalendarDate } from "@internationalized/date";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";

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

export function HeroUIDatePicker({
  value,
  onChange,
  label,
  autoFocus = false,
  isInvalid = false,
  onEscape,
  className,
  compact = false,
  variant,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  autoFocus?: boolean;
  isInvalid?: boolean;
  onEscape?: () => void;
  className?: string;
  compact?: boolean;
  variant?: "primary" | "secondary";
}) {
  const { settings } = useStore();
  const { locale, t } = useI18n();
  const calendarValue = toCalendarDate(value);
  const fieldVariant = variant ?? (compact ? "secondary" : "primary");
  const [isOpen, setIsOpen] = useState(autoFocus);
  const [isShortViewport, setIsShortViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-height: 40rem)");
    const updatePlacement = () => setIsShortViewport(mediaQuery.matches);

    updatePlacement();
    mediaQuery.addEventListener("change", updatePlacement);

    return () => mediaQuery.removeEventListener("change", updatePlacement);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onEscape?.();
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [isOpen, onEscape]);

  const commitDate = (nextValue: CalendarDate | null) => {
    if (!nextValue) return;
    onChange(nextValue.toString());
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onEscape?.();
  };

  return (
    <div
      data-tracker-date-picker
      className={`${compact ? "relative inline-flex w-fit max-w-full" : "relative w-full min-w-0"} ${className ?? ""}`}
    >
      <I18nProvider locale={locale}>
        <DatePicker
          aria-label={label}
          value={calendarValue}
          defaultOpen={autoFocus}
          isInvalid={isInvalid}
          onOpenChange={setIsOpen}
          onChange={commitDate}
          onKeyDown={handleEscape}
          className={compact ? "inline-flex w-fit max-w-full" : "w-full min-w-0"}
        >
          <DateField.Group
            fullWidth={!compact}
            variant={fieldVariant}
            className={
              compact
                ? "h-8 min-h-8 w-fit min-w-0 max-w-full overflow-hidden px-2 py-1"
                : "w-full max-w-full"
            }
          >
            <DateField.Input
              className={
                compact
                  ? "min-w-0 flex-1 gap-0 overflow-hidden p-0 whitespace-nowrap"
                  : "min-w-0 flex-1"
              }
            >
              {(segment) => (
                <DateField.Segment
                  segment={segment}
                  {...(compact ? { className: "px-0 whitespace-nowrap" } : {})}
                />
              )}
            </DateField.Input>
            {!compact ? (
              <DateField.Suffix className="shrink-0">
                <DatePicker.Trigger
                  aria-label={t("Open {label} calendar", { label })}
                  className="flex size-7 min-w-7 shrink-0 items-center justify-center"
                >
                  <DatePicker.TriggerIndicator className="size-4" />
                </DatePicker.Trigger>
              </DateField.Suffix>
            ) : null}
          </DateField.Group>

          <DatePicker.Popover
            data-tracker-date-picker-popover
            placement={isShortViewport ? "top start" : "bottom start"}
            shouldFlip
            containerPadding={12}
            offset={8}
            className="w-[min(16rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-visible p-0"
          >
            <Calendar
              aria-label={t("Select {label}", { label })}
              firstDayOfWeek={settings.weekStart === "sunday" ? "sun" : "mon"}
              className="w-full max-w-full p-3"
            >
              <Calendar.Header className="flex items-center justify-between gap-2">
                <Calendar.NavButton slot="previous" aria-label={t("Previous month")} />
                <Calendar.Heading />
                <Calendar.NavButton slot="next" aria-label={t("Next month")} />
              </Calendar.Header>
              <Calendar.Grid className="mt-2 w-full max-w-full">
                <Calendar.GridHeader>
                  {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                </Calendar.GridHeader>
                <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
              </Calendar.Grid>
            </Calendar>
          </DatePicker.Popover>
        </DatePicker>
      </I18nProvider>
    </div>
  );
}
