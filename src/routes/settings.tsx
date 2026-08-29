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
  Tabs,
  TextField,
  toast,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { PageHeader } from "@/components/page-header";
import { localeOptions, translate, useI18n } from "@/lib/i18n";
import { ProfileAvatar } from "@/components/profile-avatar";
import { prepareAvatarImage } from "@/lib/profile-image";
import { useStore, type ThemeMode } from "@/lib/store";
import { updateEmail, updatePassword } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseDataSource } from "@/lib/supabase-data-source";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Time Blossom" },
      { name: "description", content: "Account and personal preferences." },
      { property: "og:title", content: "Settings — Time Blossom" },
      { property: "og:description", content: "Configure your Time Blossom workspace." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { preferences, currentMember, setUserPreferences, updateCurrentMemberEmail } = useStore();
  const { configured, session } = useAuth();
  const dataSource = useMemo(() => createSupabaseDataSource(), []);
  const { t, error } = useI18n();
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState(
    session?.user.email ?? currentMember?.email ?? "",
  );
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAccountEmail(session?.user.email ?? currentMember?.email ?? "");
    setPassword("");
    setPasswordConfirmation("");
    setAccountError(null);
  }, [currentMember?.id, currentMember?.email, session?.user.email]);

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

  const themeOptions: Array<{
    id: ThemeMode;
    label: string;
    hint: string;
  }> = [
    { id: "system", label: "System", hint: "Follow your device theme." },
    { id: "light", label: "Light", hint: "Always use the light theme." },
    { id: "dark", label: "Dark", hint: "Always use the dark theme." },
  ];

  const savePreference = async (patch: Partial<typeof preferences>) => {
    if (configured && session) {
      const remote = await dataSource.updatePreferences(session.user.id, patch);
      if (!remote.success) {
        setPreferenceError(remote.error);
        return;
      }
    }
    const result = setUserPreferences(patch);
    if (!result.success) {
      setPreferenceError(result.error);
      return;
    }
    setPreferenceError(null);
    const locale = patch.language ?? preferences.language;
    toast(translate("Preferences saved", locale));
  };

  const savePhoto = async (file: File) => {
    try {
      const avatarUrl = await prepareAvatarImage(file);
      let savedAvatarUrl = avatarUrl;
      if (configured && session) {
        const image = await fetch(avatarUrl).then((response) => response.blob());
        const remote = await dataSource.uploadAvatar(session.user.id, image);
        if (!remote.success) {
          setAccountError(remote.error);
          return;
        }
        savedAvatarUrl = remote.data;
      }
      const result = setUserPreferences({ avatarUrl: savedAvatarUrl });
      if (!result.success) {
        setAccountError(result.error);
        return;
      }
      setAccountError(null);
      toast(t("Profile photo updated"));
    } catch (photoError) {
      const code = photoError instanceof Error ? photoError.message : "read";
      setAccountError(
        code === "type"
          ? "Choose a JPG, PNG, WebP or GIF image."
          : code === "size"
            ? "Profile photos must be smaller than 1 MB."
            : "The profile photo could not be read.",
      );
    }
  };

  const removePhoto = async () => {
    if (configured && session) {
      const remote = await dataSource.removeAvatar(session.user.id);
      if (!remote.success) {
        setAccountError(remote.error);
        return;
      }
    }
    const result = setUserPreferences({ avatarUrl: null });
    if (!result.success) {
      setAccountError(result.error);
      return;
    }
    setAccountError(null);
    toast(t("Profile photo removed"));
  };

  const saveAccount = async () => {
    if (password && password.length < 8) {
      setAccountError("Password must be at least 8 characters.");
      return;
    }
    if (password !== passwordConfirmation) {
      setAccountError("Passwords do not match.");
      return;
    }

    if (configured) {
      const nextEmail = accountEmail.trim();
      const currentEmail = session?.user.email ?? "";
      if (nextEmail && nextEmail !== currentEmail) {
        const emailResult = await updateEmail(nextEmail);
        if (!emailResult.success) {
          setAccountError(emailResult.error);
          return;
        }
      }
      if (password) {
        const passwordResult = await updatePassword(password);
        if (!passwordResult.success) {
          setAccountError(passwordResult.error);
          return;
        }
      }
    } else {
      const result = updateCurrentMemberEmail(accountEmail.trim() || currentMember?.email || "");
      if (!result.success) {
        setAccountError(result.error);
        return;
      }
    }
    setAccountError(null);
    setPassword("");
    setPasswordConfirmation("");
    toast(t("Account settings saved"));
  };

  if (!currentMember) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader
          title={t("Settings")}
          description={t("Manage your account and personal preferences.")}
        />
        <FormAlert
          title={t("Account")}
          description={t("The current account could not be loaded.")}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={t("Settings")}
        description={t("Manage your account and personal preferences.")}
      />

      <section id="account" className="surface-card scroll-mt-24 space-y-5 p-5">
        <div>
          <h2 className="font-medium text-foreground">{t("Account")}</h2>
          <p className="mt-1 text-sm text-muted">{t("Manage your profile and account details.")}</p>
        </div>

        {accountError ? (
          <FormAlert title={t("Could not save account")} description={error(accountError)} />
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <ProfileAvatar member={currentMember} avatarUrl={preferences.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{currentMember.name}</p>
            <input
              ref={avatarInputRef}
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-label={t("Change profile photo")}
              className="hidden"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void savePhoto(file);
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" type="button" onPress={() => avatarInputRef.current?.click()}>
                {t("Change profile photo")}
              </Button>
              {preferences.avatarUrl ? (
                <Button
                  size="sm"
                  type="button"
                  variant="tertiary"
                  onPress={() => void removePhoto()}
                >
                  {t("Remove profile photo")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <Form
          className="space-y-4 border-t border-separator pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void saveAccount();
          }}
        >
          <TextField
            isRequired
            fullWidth
            name="account-email"
            type="email"
            value={accountEmail}
            validate={(value) =>
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : t("Enter a valid email address")
            }
            onChange={(value) => {
              setAccountEmail(value);
              setAccountError(null);
            }}
          >
            <Label>{t("Email")}</Label>
            <Input placeholder="name@company.com" />
            <FieldError />
          </TextField>

          <TextField
            fullWidth
            name="account-password"
            type="password"
            value={password}
            validate={(value) =>
              value && value.length < 8 ? t("Password must be at least 8 characters.") : null
            }
            onChange={(value) => {
              setPassword(value);
              setAccountError(null);
            }}
          >
            <Label>{t("Password")}</Label>
            <Input placeholder={t("Leave blank to keep your current password.")} />
            <FieldError />
          </TextField>

          <TextField
            fullWidth
            name="account-password-confirmation"
            type="password"
            value={passwordConfirmation}
            validate={(value) => (value !== password ? t("Passwords do not match.") : null)}
            onChange={(value) => {
              setPasswordConfirmation(value);
              setAccountError(null);
            }}
          >
            <Label>{t("Confirm password")}</Label>
            <Input placeholder={t("Repeat your new password.")} />
            <FieldError />
          </TextField>

          <div className="flex justify-end border-t border-separator pt-4">
            <Button type="submit" isDisabled={!(accountEmail || currentMember.email).trim()}>
              {t("Save account")}
            </Button>
          </div>
        </Form>
      </section>

      <section id="personal-preferences" className="surface-card scroll-mt-24 space-y-5 p-5">
        <div>
          <h2 className="font-medium text-foreground">{t("Personal preferences")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("These preferences apply only to your account.")}
          </p>
        </div>

        {preferenceError ? (
          <FormAlert
            title={t("Could not save personal preferences")}
            description={error(preferenceError)}
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label>{t("Language")}</Label>
          <Select
            aria-label={t("Language")}
            value={preferences.language}
            onChange={(key) =>
              savePreference({ language: String(key ?? "en-US") as typeof preferences.language })
            }
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="hero-menu-surface">
              <ListBox>
                {localeOptions.map((option) => (
                  <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                    <Label>{option.label}</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Description>{t("Choose the language for your account.")}</Description>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("Theme")}</Label>
          <Tabs
            className="w-full"
            selectedKey={preferences.theme}
            onSelectionChange={(key) => savePreference({ theme: String(key) as ThemeMode })}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label={t("Theme")} className="w-full">
                {themeOptions.map((option) => (
                  <Tabs.Tab key={option.id} id={option.id} className="flex-1">
                    {t(option.label)}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {themeOptions.map((option) => (
              <Tabs.Panel key={option.id} className="pt-3 text-sm text-muted" id={option.id}>
                {t(option.hint)}
              </Tabs.Panel>
            ))}
          </Tabs>
          <Description>{t("Choose how Time Blossom should look for your account.")}</Description>
        </div>

        {toggles.map((item) => (
          <Switch
            key={item.key}
            aria-label={t(item.title)}
            isSelected={preferences[item.key]}
            onChange={(selected: boolean) =>
              savePreference({ [item.key]: selected } as Partial<typeof preferences>)
            }
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label>{t(item.title)}</Label>
              <Description>{t(item.hint)}</Description>
            </Switch.Content>
          </Switch>
        ))}
      </section>
    </div>
  );
}
