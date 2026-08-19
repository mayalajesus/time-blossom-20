import { Calendar, DateField, IconCalendar, Popover } from "@heroui/react";
import { DateInputGroup } from "@heroui/react/date-input-group";
import { CalendarDate } from "@internationalized/date";
import { useState } from "react";

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
  const calendarValue = toCalendarDate(value);
  const [isOpen, setIsOpen] = useState(false);

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
                <Popover.Trigger
                  aria-label={`Open ${label} calendar`}
                  className={
                    compact
                      ? "flex size-5 min-w-5 shrink-0 items-center justify-center rounded-md text-muted outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent"
                      : "flex size-7 min-w-7 shrink-0 items-center justify-center text-muted outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent"
                  }
                >
                  <IconCalendar className={compact ? "size-3.5" : "size-4"} />
                </Popover.Trigger>
              </DateInputGroup.Suffix>
            </DateInputGroup>
          </DateField>
        </div>

        <Popover.Content
          data-tracker-date-picker-popover
          placement="bottom start"
          shouldFlip
          containerPadding={12}
          offset={8}
          className="max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto"
        >
          <Popover.Dialog>
            <Calendar
              aria-label={`Select ${label}`}
              firstDayOfWeek="mon"
              value={calendarValue}
              onChange={commitDate}
              className="p-3"
            >
              <Calendar.Header className="flex items-center justify-between gap-2">
                <Calendar.NavButton slot="previous" aria-label="Previous month" />
                <Calendar.Heading className="text-sm font-medium" />
                <Calendar.NavButton slot="next" aria-label="Next month" />
              </Calendar.Header>
              <Calendar.Grid className="mt-2">
                <Calendar.GridHeader>
                  {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                </Calendar.GridHeader>
                <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
              </Calendar.Grid>
            </Calendar>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
}
