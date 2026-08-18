import { Button } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { LogTimeModal } from "@/components/log-time-modal";
import { PageHeader } from "@/components/page-header";
import { EmptyBlock, TableSkeleton } from "@/components/states";
import { TimerCard } from "@/components/timer-card";
import { TrackerEntries } from "@/components/tracker-entries";
import {
  formatDuration,
  formatLongDate,
  formatWeekRange,
  getWeekBounds,
  shiftDate,
} from "@/lib/format";
import { useSimulatedLoad, useStore } from "@/lib/store";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Tracker — Time Blossom time tracking" },
      {
        name: "description",
        content: "Start the live timer, log time and manage your entries in one focused workspace.",
      },
      { property: "og:title", content: "Tracker — Time Blossom time tracking" },
      {
        property: "og:description",
        content: "Live timer and daily time entries in one focused view.",
      },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const { entries, today, currentUserId, settings } = useStore();
  const loading = useSimulatedLoad();
  const [logOpen, setLogOpen] = useState(false);
  const [logDate, setLogDate] = useState(today);
  const weekStartsOn = settings.weekStart === "sunday" ? 0 : 1;
  const currentWeek = getWeekBounds(today, weekStartsOn);
  const [weekStart, setWeekStart] = useState(currentWeek.start);
  const week = getWeekBounds(weekStart, weekStartsOn);

  const days = useMemo(() => {
    const daysInWeek = Array.from({ length: 7 }, (_, index) => shiftDate(week.end, -index));

    return daysInWeek
      .map((date) => {
        const dayEntries = entries
          .filter((entry) => entry.date === date && entry.userId === currentUserId)
          .sort((a, b) => a.start.localeCompare(b.start));

        return {
          date,
          totalSeconds: dayEntries.reduce((total, entry) => total + entry.seconds, 0),
          entries: dayEntries,
        };
      })
      .filter((day) => day.entries.length > 0);
  }, [currentUserId, entries, week.start]);

  const weekTotal = days.reduce((total, day) => total + day.totalSeconds, 0);
  const isCurrentWeek = week.start === currentWeek.start;

  const openLog = (date: string) => {
    setLogDate(date);
    setLogOpen(true);
  };

  return (
    <div className="space-y-7">
      <PageHeader title="Tracker" description={formatLongDate(today)} />

      <TimerCard />

      <section className="space-y-4" aria-labelledby="weekly-entries-heading">
        <div className="flex flex-col gap-3 border-b border-default pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-1">
            <Button
              isIconOnly
              aria-label="Previous week"
              size="sm"
              variant="tertiary"
              onPress={() => setWeekStart(shiftDate(week.start, -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2
              id="weekly-entries-heading"
              className="min-w-0 px-2 text-sm font-medium text-foreground"
            >
              <span className="sm:hidden">{formatWeekRange(week.start, week.end)}</span>
              <span className="hidden sm:inline">
                Week of {formatWeekRange(week.start, week.end)}
              </span>
            </h2>
            <Button
              isIconOnly
              aria-label="Next week"
              size="sm"
              variant="tertiary"
              onPress={() => setWeekStart(shiftDate(week.start, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <span className="text-sm tabular-nums text-muted">
              {formatDuration(weekTotal)} this week
            </span>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => openLog(isCurrentWeek ? today : week.start)}
            >
              <CalendarPlus className="size-4" />
              Add entry
            </Button>
            {!isCurrentWeek ? (
              <Button size="sm" variant="secondary" onPress={() => setWeekStart(currentWeek.start)}>
                This week
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : days.length === 0 ? (
          <EmptyBlock
            icon={<Clock className="size-5" />}
            title="No time tracked this week"
            description="Start the timer above or add an entry for an earlier date in this week."
            action={
              <Button size="sm" variant="secondary" onPress={() => openLog(week.start)}>
                <CalendarPlus className="size-4" />
                Add entry
              </Button>
            }
          />
        ) : (
          <TrackerEntries days={days} />
        )}
      </section>

      <LogTimeModal isOpen={logOpen} initialDate={logDate} onOpenChange={setLogOpen} />
    </div>
  );
}
