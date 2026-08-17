import { Button } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Clock } from "lucide-react";
import { useState } from "react";
import { EntriesTable } from "@/components/entries-table";
import { LogTimeModal } from "@/components/log-time-modal";
import { PageHeader } from "@/components/page-header";
import { EmptyBlock, TableSkeleton } from "@/components/states";
import { TimerCard } from "@/components/timer-card";
import { formatLongDate } from "@/lib/format";
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
  const { entries, today, currentUserId } = useStore();
  const loading = useSimulatedLoad();
  const [logOpen, setLogOpen] = useState(false);

  const todays = entries.filter((e) => e.date === today && e.userId === currentUserId);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracker"
        description={formatLongDate(today)}
        actions={
          <Button variant="secondary" onPress={() => setLogOpen(true)}>
            <CalendarPlus className="size-4" />
            Log time
          </Button>
        }
      />

      <TimerCard />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Time entries</h2>
        {loading ? (
          <TableSkeleton />
        ) : todays.length === 0 ? (
          <EmptyBlock
            icon={<Clock className="size-5" />}
            title="No time tracked yet"
            description="Start the timer above or log an entry manually to fill your day."
            action={
              <Button size="sm" variant="secondary" onPress={() => setLogOpen(true)}>
                Log time
              </Button>
            }
          />
        ) : (
          <EntriesTable entries={todays} />
        )}
      </div>

      <LogTimeModal isOpen={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}
