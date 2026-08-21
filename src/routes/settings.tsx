import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  TextField,
  toast,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FormAlert } from "@/components/form-feedback";
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
  const {
    settings,
    preferences,
    members,
    currentMember,
    can,
    setWorkspaceSettings,
    setUserPreferences,
    setActiveMember,
  } = useStore();
  const [name, setName] = useState(settings.workspaceName);
  const [weekStart, setWeekStart] = useState(settings.weekStart);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const toggles = [
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

  const saveWorkspace = () => {
    const result = setWorkspaceSettings({ workspaceName: name.trim(), weekStart });
    if (!result.success) {
      setWorkspaceError(result.error);
      return;
    }
    setWorkspaceError(null);
    toast("Workspace settings saved");
  };

  const changeIdentity = (memberId: string) => {
    const result = setActiveMember(memberId);
    if (!result.success) {
      setIdentityError(result.error);
      return;
    }
    window.location.reload();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Workspace preferences and defaults." />

      {can("manage-workspace-settings") ? (
        <Form
          className="space-y-5 rounded-2xl border border-default bg-surface p-5"
          onSubmit={(event) => {
            event.preventDefault();
            saveWorkspace();
          }}
        >
          <div>
            <h2 className="font-medium text-foreground">Workspace settings</h2>
            <p className="mt-1 text-sm text-muted">Defaults shared by everyone in the workspace.</p>
          </div>

          {workspaceError ? (
            <FormAlert title="Could not save workspace settings" description={workspaceError} />
          ) : null}

          <TextField
            isRequired
            fullWidth
            name="workspace-name"
            value={name}
            validate={(value) => (value.trim() ? null : "Workspace name is required")}
            onChange={(value) => {
              setName(value);
              setWorkspaceError(null);
            }}
          >
            <Label>Workspace name</Label>
            <Input />
            <FieldError />
          </TextField>

          <Switch
            aria-label="Billable by default"
            isSelected={settings.defaultBillable}
            onChange={(selected: boolean) => {
              const result = setWorkspaceSettings({ defaultBillable: selected });
              if (!result.success) setWorkspaceError(result.error);
            }}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label>Billable by default</Label>
              <Description>New entries start marked as billable.</Description>
            </Switch.Content>
          </Switch>

          <div className="flex flex-col gap-2">
            <Label>Week starts on</Label>
            <Select
              aria-label="Week starts on"
              value={weekStart}
              onChange={(key) => setWeekStart(String(key ?? "monday"))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="monday" textValue="Monday">
                    <Label>Monday</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="sunday" textValue="Sunday">
                    <Label>Sunday</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          <div className="flex justify-end border-t border-default pt-4">
            <Button type="submit" isDisabled={!name.trim()}>
              Save workspace settings
            </Button>
          </div>
        </Form>
      ) : null}

      <div className="space-y-5 rounded-2xl border border-default bg-surface p-5">
        <div>
          <h2 className="font-medium text-foreground">Personal preferences</h2>
          <p className="mt-1 text-sm text-muted">These preferences apply only to your account.</p>
        </div>

        {toggles.map((item) => (
          <Switch
            key={item.key}
            aria-label={item.title}
            isSelected={preferences[item.key]}
            onChange={(selected: boolean) => setUserPreferences({ [item.key]: selected })}
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
      </div>

      <div className="space-y-3 rounded-2xl border border-default bg-surface p-5">
        <div>
          <h2 className="font-medium text-foreground">Preview identity</h2>
          <p className="mt-1 text-sm text-muted">
            Local-only preview control; it does not represent real authentication.
          </p>
        </div>
        {identityError ? (
          <FormAlert title="Could not change preview identity" description={identityError} />
        ) : null}
        <Select
          aria-label="Preview identity"
          value={currentMember?.id ?? ""}
          onChange={(key) => changeIdentity(String(key ?? ""))}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {members
                .filter((member) => member.status === "active")
                .map((member) => (
                  <ListBox.Item
                    key={member.id}
                    id={member.id}
                    textValue={`${member.name} ${member.role}`}
                  >
                    <div className="flex min-w-0 flex-col">
                      <Label>{member.name}</Label>
                      <Description>{member.role}</Description>
                    </div>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
    </div>
  );
}
