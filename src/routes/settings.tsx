import {
  Card,
  Button,
  ButtonGroup,
  Description,
  Dropdown,
  FieldError,
  Form,
  Input,
  Label,
  Switch,
  Tabs,
  TextField,
  Typography,
  toast,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "@gravity-ui/icons";
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

function splitAccountName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function SettingsPage() {
  const {
    preferences,
    currentMember,
    setUserPreferences,
    updateCurrentMemberName,
    updateCurrentMemberEmail,
  } = useStore();
  const { configured, session } = useAuth();
  const dataSource = useMemo(() => createSupabaseDataSource(), []);
  const { t, error } = useI18n();
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [accountFirstName, setAccountFirstName] = useState(
    splitAccountName(currentMember?.name ?? "").firstName,
  );
  const [accountLastName, setAccountLastName] = useState(
    splitAccountName(currentMember?.name ?? "").lastName,
  );
  const [accountEmail, setAccountEmail] = useState(
    session?.user.email ?? currentMember?.email ?? "",
  );
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const name = splitAccountName(currentMember?.name ?? "");
    setAccountFirstName(name.firstName);
    setAccountLastName(name.lastName);
    setAccountEmail(session?.user.email ?? currentMember?.email ?? "");
    setPassword("");
    setPasswordConfirmation("");
    setAccountError(null);
  }, [currentMember?.id, currentMember?.name, currentMember?.email, session?.user.email]);

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
      hint: "Ask whether to pause the timer after long inactivity.",
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
    toast.success(translate("Your preferences are up to date", locale));
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
      toast.success(t("Your profile photo is updated"));
    } catch (photoError) {
      const code = photoError instanceof Error ? photoError.message : "read";
      setAccountError(
        code === "type"
          ? "Choose a JPG, PNG, WebP or GIF image."
          : code === "size"
            ? "Profile photos must be smaller than 1 MB."
            : t("The profile photo couldn't be read. Try another image."),
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
    toast.success(t("Your profile photo was removed"));
  };

  const saveAccount = async () => {
    const firstName = accountFirstName.trim().replace(/\s+/g, " ");
    const lastName = accountLastName.trim().replace(/\s+/g, " ");
    if (!firstName) {
      setAccountError("A first name is required.");
      return;
    }
    if (!lastName) {
      setAccountError("A last name is required.");
      return;
    }
    const nextName = `${firstName} ${lastName}`;
    if (nextName.length > 120) {
      setAccountError("Name must be 120 characters or fewer.");
      return;
    }
    if (password && password.length < 8) {
      setAccountError("Password must be at least 8 characters.");
      return;
    }
    if (password !== passwordConfirmation) {
      setAccountError("Passwords do not match.");
      return;
    }

    if (configured) {
      if (session && nextName !== currentMember?.name) {
        const nameResult = await dataSource.updateProfileName(session.user.id, nextName);
        if (!nameResult.success) {
          setAccountError(nameResult.error);
          return;
        }
      }
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
      const nameResult = updateCurrentMemberName(nextName);
      if (!nameResult.success) {
        setAccountError(nameResult.error);
        return;
      }
      const result = updateCurrentMemberEmail(accountEmail.trim() || currentMember?.email || "");
      if (!result.success) {
        setAccountError(result.error);
        return;
      }
    }
    if (configured && nextName !== currentMember?.name) {
      const nameResult = updateCurrentMemberName(nextName);
      if (!nameResult.success) {
        setAccountError(nameResult.error);
        return;
      }
    }
    setAccountError(null);
    setPassword("");
    setPasswordConfirmation("");
    toast.success(t("Your account is up to date"));
  };

  if (!currentMember) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader
          title={t("Settings")}
          description={t("Manage your account and personal preferences.")}
        />
        <FormAlert
          title={t("We couldn't load your account")}
          description={t("Your account details are unavailable right now. Try again shortly.")}
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

      <Card id="account" className="scroll-mt-24 space-y-4 p-4">
        <div className="space-y-1">
          <Typography type="h2" weight="semibold">
            {t("Account")}
          </Typography>
          <Typography type="body-sm" color="muted">
            {t("Manage your profile and account details.")}
          </Typography>
        </div>

        {accountError ? (
          <FormAlert title={t("We couldn't save your account")} description={error(accountError)} />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <ProfileAvatar member={currentMember} avatarUrl={preferences.avatarUrl} size="lg" />
          <div className="min-w-0">
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
            <div className="flex flex-wrap items-center gap-2">
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
          className="space-y-3 pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            void saveAccount();
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <TextField
              isRequired
              fullWidth
              className="min-w-0 flex-1"
              name="account-first-name"
              value={accountFirstName}
              validate={(value) => (value.trim() ? null : t("A first name is required."))}
              onChange={(value) => {
                setAccountFirstName(value);
                setAccountError(null);
              }}
            >
              <Label>{t("First name")}</Label>
              <Input variant="secondary" placeholder={t("Your first name")} maxLength={60} />
              <FieldError />
            </TextField>

            <TextField
              isRequired
              fullWidth
              className="min-w-0 flex-1"
              name="account-last-name"
              value={accountLastName}
              validate={(value) => (value.trim() ? null : t("A last name is required."))}
              onChange={(value) => {
                setAccountLastName(value);
                setAccountError(null);
              }}
            >
              <Label>{t("Last name")}</Label>
              <Input variant="secondary" placeholder={t("Your last name")} maxLength={60} />
              <FieldError />
            </TextField>
          </div>

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
            <Input variant="secondary" placeholder="name@company.com" />
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
            <Input
              variant="secondary"
              placeholder={t("Leave blank to keep your current password.")}
            />
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
            <Input variant="secondary" placeholder={t("Repeat your new password.")} />
            <FieldError />
          </TextField>

          <div className="flex justify-end pt-1">
            <Button type="submit" isDisabled={!(accountEmail || currentMember.email).trim()}>
              {t("Save account")}
            </Button>
          </div>
        </Form>
      </Card>

      <Card id="personal-preferences" className="scroll-mt-24 space-y-4 p-4">
        <div className="space-y-1">
          <Typography type="h2" weight="semibold">
            {t("Preferences")}
          </Typography>
          <Typography type="body-sm" color="muted">
            {t("These preferences apply only to your account.")}
          </Typography>
        </div>

        {preferenceError ? (
          <FormAlert
            title={t("We couldn't save your preferences")}
            description={error(preferenceError)}
          />
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label>{t("Language")}</Label>
          <Dropdown>
            <ButtonGroup variant="secondary" size="sm" className="w-full">
              <Button
                type="button"
                aria-label={t("Language")}
                className="h-9 min-w-0 flex-1 justify-start"
              >
                {localeOptions.find((option) => option.id === preferences.language)?.label}
              </Button>
              <Dropdown.Trigger
                aria-label={t("Choose language")}
                className="h-9 w-9 min-w-9 shrink-0 px-0"
              >
                <ChevronDown aria-hidden="true" className="size-4" />
              </Dropdown.Trigger>
            </ButtonGroup>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label={t("Language")}
                selectionMode="single"
                selectedKeys={new Set([preferences.language])}
                onAction={(key) =>
                  savePreference({ language: String(key) as typeof preferences.language })
                }
              >
                {localeOptions.map((option) => (
                  <Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
                    <Label>{option.label}</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <Description>{t("Choose the language for your account.")}</Description>
        </div>

        <div className="flex flex-col gap-1.5">
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
              <Tabs.Panel key={option.id} className="px-0 pt-2" id={option.id}>
                {t(option.hint)}
              </Tabs.Panel>
            ))}
          </Tabs>
          <Description>{t("Choose how Time Blossom should look for your account.")}</Description>
        </div>

        <div className="space-y-3">
          {toggles.map((item) => (
            <Switch
              key={item.key}
              aria-label={t(item.title)}
              className="w-full"
              isSelected={preferences[item.key]}
              onChange={(selected: boolean) =>
                savePreference({ [item.key]: selected } as Partial<typeof preferences>)
              }
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Content className="min-w-0">
                <Label>{t(item.title)}</Label>
                <Description>{t(item.hint)}</Description>
              </Switch.Content>
            </Switch>
          ))}
        </div>
      </Card>
    </div>
  );
}
