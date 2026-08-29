import { Button } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { LogTimeModal } from "@/components/log-time-modal";
import { PageHeader } from "@/components/page-header";
import { EmptyBlock, TableSkeleton } from "@/components/states";
import { TimerCard } from "@/components/timer-card";
import { TrackerEntries } from "@/components/tracker-entries";
import { TrackerPeriodFilter } from "@/components/tracker-period-filter";
import {
  formatDuration,
  formatLongDate,
  getWeekBounds,
  listDateRange,
  shiftTrackerPeriod,
  type TrackerPeriod,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useSimulatedLoad, useStore } from "@/lib/store";

export const Route = createFileRoute("/tracker")({
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
  component: TrackerPage,
});

function TrackerPage() {
  const { entries, today, currentUserId, settings, timer } = useStore();
  const { locale, t } = useI18n();
  const loading = useSimulatedLoad();
  const [logOpen, setLogOpen] = useState(false);
  const weekStartsOn = settings.weekStart === "sunday" ? 0 : 1;
  const currentWeek = getWeekBounds(today, weekStartsOn);
  const [period, setPeriod] = useState<TrackerPeriod>({
    unit: "week",
    startDate: currentWeek.start,
    endDate: currentWeek.end,
  });

  const days = useMemo(() => {
    const dates = listDateRange(period.startDate, period.endDate).reverse();

    return dates
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
  }, [currentUserId, entries, period.endDate, period.startDate]);

  const periodTotal = days.reduce((total, day) => total + day.totalSeconds, 0);
  const navigationUnit = period.unit === "custom" ? "range" : period.unit;
  const isCurrentWeek =
    period.unit === "week" &&
    period.startDate === currentWeek.start &&
    period.endDate === currentWeek.end;

  const openLog = () => setLogOpen(true);

  return (
    <div className="space-y-7">
      <PageHeader title={t("Tracker")} description={formatLongDate(today, locale)} />

      <TimerCard />

      <section className="space-y-4" aria-labelledby="tracker-period-heading">
        <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-1">
            <Button
              isIconOnly
              aria-label={t("Previous {unit}", {
                unit: t(navigationUnit === "range" ? "range" : navigationUnit),
              })}
              size="sm"
              variant="tertiary"
              onPress={() => setPeriod(shiftTrackerPeriod(period, -1, weekStartsOn))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2 id="tracker-period-heading" className="min-w-0 px-1">
              <TrackerPeriodFilter
                period={period}
                today={today}
                weekStartsOn={weekStartsOn}
                onChange={setPeriod}
              />
            </h2>
            <Button
              isIconOnly
              aria-label={t("Next {unit}", {
                unit: t(navigationUnit === "range" ? "range" : navigationUnit),
              })}
              size="sm"
              variant="tertiary"
              onPress={() => setPeriod(shiftTrackerPeriod(period, 1, weekStartsOn))}
            >
              <ChevronRight className="size-4" />
            </Button>
            {!isCurrentWeek && (
              <Button
                size="sm"
                variant="tertiary"
                className="shrink-0 px-2"
                onPress={() =>
                  setPeriod({
                    unit: "week",
                    startDate: currentWeek.start,
                    endDate: currentWeek.end,
                  })
                }
              >
                {t("This week")}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <span>
              {formatDuration(periodTotal, locale)} {t("tracked")}
            </span>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={timer.status !== "idle"}
              onPress={openLog}
            >
              <CalendarPlus className="size-4" />
              {t("Add entry")}
            </Button>
          </div>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : days.length === 0 ? (
          <EmptyBlock
            icon={<Clock className="size-5" />}
            title={t("No time tracked in this period")}
            description={t("Start the timer above or add an entry for a date in this period.")}
            action={
              <Button
                size="sm"
                variant="secondary"
                isDisabled={timer.status !== "idle"}
                onPress={openLog}
              >
                <CalendarPlus className="size-4" />
                {t("Add entry")}
              </Button>
            }
          />
        ) : (
          <TrackerEntries days={days} />
        )}
      </section>

      <LogTimeModal isOpen={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}
