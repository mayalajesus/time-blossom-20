import { Button, Calendar, DateField, IconCalendar, I18nProvider, Popover } from "@heroui/react";
import { DateInputGroup } from "@heroui/react/date-input-group";
import { CalendarDate } from "@internationalized/date";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { PopoverTriggerRegistration } from "@/components/overlay-trigger-registration";

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
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  autoFocus?: boolean;
  isInvalid?: boolean;
  onEscape?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const { settings } = useStore();
  const { locale, t } = useI18n();
  const calendarValue = toCalendarDate(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isShortViewport, setIsShortViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-height: 40rem)");
    const updatePlacement = () => setIsShortViewport(mediaQuery.matches);

    updatePlacement();
    mediaQuery.addEventListener("change", updatePlacement);

    return () => mediaQuery.removeEventListener("change", updatePlacement);
  }, []);

  const closeCalendar = () => {
    setIsOpen(false);
  };

  const commitDate = (nextValue: CalendarDate | null) => {
    if (!nextValue) return;
    onChange(nextValue.toString());
    closeCalendar();
  };

  const closeWithRestore = () => {
    closeCalendar();
    onEscape?.();
  };

  return (
    <div data-tracker-date-picker className={`relative w-full min-w-0 ${className ?? ""}`}>
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <PopoverTriggerRegistration />
        <div
          className="w-full min-w-0"
          onPointerDown={(event) => {
            const target = event.target as HTMLElement;

            if (target.closest('[data-slot="popover-trigger"]')) return;

            setIsOpen(true);
          }}
          onClick={(event) => {
            const target = event.target as HTMLElement;

            // Let HeroUI's Popover.Trigger toggle the calendar when the icon is clicked.
            if (target.closest('[data-slot="popover-trigger"]')) return;

            setIsOpen(true);
          }}
        >
          <DateField
            aria-label={label}
            autoFocus={autoFocus}
            isInvalid={isInvalid}
            value={calendarValue}
            onChange={commitDate}
            onFocus={() => {
              const activeElement = document.activeElement;

              // The trigger owns its own open/close behavior. Only focus entering
              // the date segments should open the calendar.
              if (activeElement?.closest('[data-slot="popover-trigger"]')) return;

              setIsOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeWithRestore();
              }
            }}
            className="w-full min-w-0"
          >
            <DateInputGroup
              fullWidth
              variant={compact ? "secondary" : "primary"}
              className={
                compact
                  ? "!h-8 !min-h-8 !w-full !max-w-full !overflow-hidden !rounded-lg !px-2 !py-1 text-sm"
                  : "w-full max-w-full"
              }
            >
              <DateInputGroup.Input
                onPointerDown={() => setIsOpen(true)}
                className={
                  compact
                    ? "min-w-0 flex-1 !overflow-hidden !p-0 text-xs tabular-nums whitespace-nowrap"
                    : "min-w-0 flex-1"
                }
              >
                {(segment) => <DateInputGroup.Segment segment={segment} />}
              </DateInputGroup.Input>
              <DateInputGroup.Suffix className="shrink-0">
                <Button
                  variant="ghost"
                  isIconOnly
                  aria-label={t("Open {label} calendar", { label })}
                  className={
                    compact
                      ? "flex size-5 min-w-5 shrink-0 items-center justify-center rounded-md text-muted outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent"
                      : "flex size-7 min-w-7 shrink-0 items-center justify-center text-muted outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent"
                  }
                >
                  <IconCalendar className={compact ? "size-3.5" : "size-4"} />
                </Button>
              </DateInputGroup.Suffix>
            </DateInputGroup>
          </DateField>
        </div>

        <Popover.Content
          data-tracker-date-picker-popover
          placement={isShortViewport ? "top start" : "bottom start"}
          shouldFlip
          containerPadding={12}
          offset={8}
          className="calendar-popover-content calendar-popover-single w-[min(16rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-visible p-0"
        >
          <Popover.Dialog>
            <I18nProvider locale={locale}>
              <Calendar
                aria-label={t("Select {label}", { label })}
                firstDayOfWeek={settings.weekStart === "sunday" ? "sun" : "mon"}
                value={calendarValue}
                onChange={commitDate}
                className="calendar-no-scroll w-full max-w-full p-3"
              >
                <Calendar.Header className="flex items-center justify-between gap-2">
                  <Calendar.NavButton slot="previous" aria-label={t("Previous month")} />
                  <Calendar.Heading className="text-sm font-medium" />
                  <Calendar.NavButton slot="next" aria-label={t("Next month")} />
                </Calendar.Header>
                <Calendar.Grid className="mt-2 w-full max-w-full">
                  <Calendar.GridHeader>
                    {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                  </Calendar.GridHeader>
                  <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                </Calendar.Grid>
              </Calendar>
            </I18nProvider>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
}
