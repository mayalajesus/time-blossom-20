import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Switch,
  TextField,
  toast,
} from "@heroui/react";
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

      <Form
        className="space-y-5 rounded-2xl border border-default bg-surface p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setSettings({ workspaceName: name.trim() });
          toast("Settings saved");
        }}
      >
        <TextField
          isRequired
          fullWidth
          name="workspace-name"
          value={name}
          validate={(value) => (value.trim() ? null : "Workspace name is required")}
          onChange={setName}
        >
          <Label>Workspace name</Label>
          <Input />
          <FieldError />
        </TextField>

        {toggles.map((item) => (
          <Switch
            key={item.key}
            aria-label={item.title}
            isSelected={settings[item.key]}
            onChange={(selected: boolean) => setSettings({ [item.key]: selected })}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label>{item.title}</Label>
              <Description>{item.hint}</Description>
            </Switch.Content>
          </Switch>
        ))}

        <div className="flex justify-end border-t border-default pt-4">
          <Button type="submit" isDisabled={!name.trim()}>
            Save changes
          </Button>
        </div>
      </Form>
    </div>
  );
}
