import { Button, Input, Label, toast } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Time Blossom" },
      { name: "description", content: "Workspace name, default billing and reminder preferences." },
      { property: "og:title", content: "Settings — Time Blossom" },
      { property: "og:description", content: "Configure your Time Blossom workspace." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, setSettings } = useStore();
  const [name, setName] = useState(settings.workspaceName);

  const toggles = [
    {
      key: "defaultBillable" as const,
      title: "Billable by default",
      hint: "New entries start marked as billable.",
    },
    {
      key: "reminders" as const,
      title: "Reminders",
      hint: "Nudge me when I forget to start a timer.",
    },
    {
      key: "weeklyDigest" as const,
      title: "Weekly digest",
      hint: "Email me a summary every Monday.",
    },
    {
      key: "idleDetection" as const,
      title: "Idle detection",
      hint: "Pause the timer after long inactivity.",
    },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Workspace preferences and defaults." />

      <div className="space-y-5 rounded-2xl border border-default bg-surface p-5">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            fullWidth
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {toggles.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-sm text-muted">{item.hint}</p>
            </div>
            <Button
              aria-label={item.title}
              aria-pressed={settings[item.key]}
              className="h-7 w-12 min-w-12 justify-start rounded-full p-1 data-[pressed=true]:justify-end"
              isIconOnly
              variant="tertiary"
              onPress={() => setSettings({ [item.key]: !settings[item.key] })}
            >
              <span className="size-5 rounded-full bg-foreground shadow-sm" />
            </Button>
          </div>
        ))}

        <div className="flex justify-end border-t border-default pt-4">
          <Button
            onPress={() => {
              setSettings({ workspaceName: name });
              toast("Settings saved");
            }}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
