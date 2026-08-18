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
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  autoFocus?: boolean;
  isInvalid?: boolean;
  onEscape?: () => void;
  className?: string;
}) {
  const calendarValue = toCalendarDate(value);
  const [isOpen, setIsOpen] = useState(false);

  const closeWithRestore = () => {
    setIsOpen(false);
    onEscape?.();
  };

  return (
    <div data-tracker-date-picker className={`relative w-full min-w-0 ${className ?? ""}`}>
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <DateField
          aria-label={label}
          autoFocus={autoFocus}
          isInvalid={isInvalid}
          value={calendarValue}
          onChange={(nextValue) => {
            if (nextValue) {
              onChange(nextValue.toString());
              setIsOpen(false);
            }
          }}
          onFocus={() => setIsOpen(true)}
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
            variant="secondary"
            className="!h-8 !min-h-8 !w-full !max-w-full !overflow-hidden !rounded-lg !px-2 !py-1 text-sm"
          >
            <DateInputGroup.Input className="min-w-0 flex-1 !overflow-hidden !p-0 text-xs tabular-nums whitespace-nowrap">
              {(segment) => <DateInputGroup.Segment segment={segment} />}
            </DateInputGroup.Input>
            <DateInputGroup.Suffix className="shrink-0">
              <Popover.Trigger
                aria-label={`Open ${label} calendar`}
                className="flex size-5 min-w-5 shrink-0 items-center justify-center rounded-md text-muted outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent"
              >
                <IconCalendar className="size-3.5" />
              </Popover.Trigger>
            </DateInputGroup.Suffix>
          </DateInputGroup>
        </DateField>

        <Popover.Content
          data-tracker-date-picker-popover
          placement="bottom start"
          className="max-w-[calc(100vw-2rem)]"
        >
          <Popover.Dialog>
            <Calendar
              aria-label={`Select ${label}`}
              firstDayOfWeek="mon"
              value={calendarValue}
              onChange={(nextValue) => {
                if (nextValue) {
                  onChange(nextValue.toString());
                  setIsOpen(false);
                }
              }}
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
