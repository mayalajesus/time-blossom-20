import {
  Card,
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
import {
  getGoogleProfileAvatarUrl,
  isUserUploadedAvatarUrl,
  prepareAvatarImage,
} from "@/lib/profile-image";
import { useStore, type ThemeMode } from "@/lib/store";
import { updateEmail, updatePassword } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseDataSource } from "@/lib/supabase-data-source";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  currencyOptions,
  formatMoney,
  parseHourlyRateInput,
  type CurrencyCode,
} from "@/lib/billing";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Watchtag" },
      { name: "description", content: "Account and personal preferences." },
      { property: "og:title", content: "Settings — Watchtag" },
      { property: "og:description", content: "Configure your Watchtag workspace." },
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

type AccountFormSnapshot = {
  firstName: string;
  lastName: string;
  email: string;
};

function normalizeAccountNamePart(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAccountEmail(value: string) {
  return value.trim().toLowerCase();
}

function SettingsPage() {
  const {
    preferences,
    currentMember,
    setUserPreferences,
    saveUserPreferences,
    updateCurrentMemberName,
    updateCurrentMemberEmail,
  } = useStore();
  const { configured, session } = useAuth();
  const dataSource = useMemo(() => createSupabaseDataSource(), []);
  const { t, error } = useI18n();
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState(preferences.hourlyRate.toFixed(2));
  const [currency, setCurrency] = useState<CurrencyCode>(preferences.currency);
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
  const [accountBaseline, setAccountBaseline] = useState<AccountFormSnapshot>(() => {
    const name = splitAccountName(currentMember?.name ?? "");
    return {
      ...name,
      email: session?.user.email ?? currentMember?.email ?? "",
    };
  });
  const [photoAction, setPhotoAction] = useState<"uploading" | "removing" | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const photoActionRef = useRef<"uploading" | "removing" | null>(null);

  useEffect(() => {
    const name = splitAccountName(currentMember?.name ?? "");
    setAccountFirstName(name.firstName);
    setAccountLastName(name.lastName);
    setAccountEmail(session?.user.email ?? currentMember?.email ?? "");
    setAccountBaseline({
      ...name,
      email: session?.user.email ?? currentMember?.email ?? "",
    });
    setPassword("");
    setPasswordConfirmation("");
    setAccountError(null);
  }, [currentMember?.id, currentMember?.name, currentMember?.email, session?.user.email]);

  useEffect(() => {
    setHourlyRate(preferences.hourlyRate.toFixed(2));
    setCurrency(preferences.currency);
  }, [preferences.currency, preferences.hourlyRate]);

  const toggles = [
    {
      key: "reminders" as const,
      title: "Reminders",
      hint: "Remind me every 60 minutes while a timer is running.",
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
    const result = await saveUserPreferences(patch);
    if (!result.success) {
      setPreferenceError(result.error);
      return;
    }
    setPreferenceError(null);
    const locale = patch.language ?? preferences.language;
    toast.success(translate("Your preferences are up to date", locale));
  };

  const parsedHourlyRate = parseHourlyRateInput(hourlyRate);
  const hourlyRateError = !hourlyRate.trim()
    ? t("Hourly rate is required.")
    : hourlyRate.trim().startsWith("-")
      ? t("Hourly rate must be zero or greater.")
      : parsedHourlyRate === null
        ? t("Enter a valid hourly rate with up to two decimal places.")
        : undefined;

  const saveBillingPreferences = () => {
    if (parsedHourlyRate === null) return;
    void savePreference({ hourlyRate: parsedHourlyRate, currency });
  };

  const accountHasChanges =
    normalizeAccountNamePart(accountFirstName) !==
      normalizeAccountNamePart(accountBaseline.firstName) ||
    normalizeAccountNamePart(accountLastName) !==
      normalizeAccountNamePart(accountBaseline.lastName) ||
    normalizeAccountEmail(accountEmail) !== normalizeAccountEmail(accountBaseline.email) ||
    Boolean(password || passwordConfirmation);

  const savePhoto = async (file: File) => {
    if (photoActionRef.current) return;
    photoActionRef.current = "uploading";
    setPhotoAction("uploading");
    setAccountError(null);
    try {
      const avatarUrl = await prepareAvatarImage(file);
      if (isSupabaseConfigured && session) {
        const image = await fetch(avatarUrl).then((response) => response.blob());
        const remote = await dataSource.uploadAvatar(session.user.id, image);
        if (!remote.success) {
          setAccountError(remote.error);
          return;
        }
        const result = setUserPreferences({ avatarUrl: remote.data });
        if (!result.success) {
          setAccountError(result.error);
          return;
        }
      } else {
        const result = await saveUserPreferences({ avatarUrl });
        if (!result.success) {
          setAccountError(result.error);
          return;
        }
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
    } finally {
      photoActionRef.current = null;
      setPhotoAction(null);
    }
  };

  const removePhoto = async () => {
    if (photoActionRef.current || !isUserUploadedAvatarUrl(preferences.avatarUrl)) return;
    photoActionRef.current = "removing";
    setPhotoAction("removing");
    setAccountError(null);
    let storageWasRemoved = false;
    const fallbackAvatarUrl = getGoogleProfileAvatarUrl(session?.user.user_metadata);
    try {
      if (isSupabaseConfigured && session) {
        const remote = await dataSource.removeAvatar(session.user.id);
        if (!remote.success) {
          setAccountError(remote.error);
          return;
        }
        storageWasRemoved = true;
      }
      const result = await saveUserPreferences({ avatarUrl: fallbackAvatarUrl });
      if (!result.success) {
        if (storageWasRemoved) setUserPreferences({ avatarUrl: fallbackAvatarUrl });
        setAccountError(result.error);
        return;
      }
      setAccountError(null);
      toast.success(t("Your profile photo was removed"));
    } finally {
      photoActionRef.current = null;
      setPhotoAction(null);
    }
  };

  const saveAccount = async () => {
    if (!accountHasChanges) return;
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
      if (isSupabaseConfigured && session && nextName !== currentMember?.name) {
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
    setAccountBaseline({ firstName, lastName, email: accountEmail.trim() });
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
              disabled={photoAction !== null}
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void savePhoto(file);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                type="button"
                isDisabled={photoAction !== null}
                isPending={photoAction === "uploading"}
                onPress={() => avatarInputRef.current?.click()}
              >
                {t("Change profile photo")}
              </Button>
              {isUserUploadedAvatarUrl(preferences.avatarUrl) ? (
                <Button
                  size="sm"
                  type="button"
                  variant="tertiary"
                  isDisabled={photoAction !== null}
                  isPending={photoAction === "removing"}
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
            <Button
              type="submit"
              isDisabled={!accountHasChanges || !(accountEmail || currentMember.email).trim()}
            >
              {t("Save account")}
            </Button>
          </div>
        </Form>
      </Card>

      <Card id="personal-preferences" className="scroll-mt-24 space-y-4 p-4">
        <Typography type="h2" weight="semibold">
          {t("Preferences")}
        </Typography>

        {preferenceError ? (
          <FormAlert
            title={t("We couldn't save your preferences")}
            description={error(preferenceError)}
          />
        ) : null}

        <Select
          fullWidth
          variant="secondary"
          selectedKey={preferences.language}
          onSelectionChange={(key) =>
            savePreference({ language: String(key) as typeof preferences.language })
          }
        >
          <Label>{t("Language")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator>
              <ChevronDown aria-hidden="true" className="size-4" />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover>
            <ListBox aria-label={t("Language")}>
              {localeOptions.map((option) => (
                <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                  <Label>{option.label}</Label>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

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
        </div>

        <Form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveBillingPreferences();
          }}
        >
          <Typography type="body-sm" weight="semibold">
            {t("Billing rate")}
          </Typography>
          <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <TextField
              isRequired
              fullWidth
              name="hourly-rate"
              value={hourlyRate}
              isInvalid={Boolean(hourlyRateError)}
              onChange={setHourlyRate}
            >
              <Label>{t("Hourly rate")}</Label>
              <Input variant="secondary" inputMode="decimal" placeholder="0.00" />
              <FieldError>{hourlyRateError}</FieldError>
            </TextField>
            <Select
              fullWidth
              variant="secondary"
              selectedKey={currency}
              onSelectionChange={(key) => setCurrency(String(key) as CurrencyCode)}
            >
              <Label>{t("Currency")}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator>
                  <ChevronDown aria-hidden="true" className="size-4" />
                </Select.Indicator>
              </Select.Trigger>
              <Select.Popover>
                <ListBox aria-label={t("Currency")}>
                  {currencyOptions.map((option) => (
                    <ListBox.Item key={option} id={option} textValue={option}>
                      <Label>{option}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Typography type="body-sm" color="muted">
              {t("Preview: {value}", {
                value: formatMoney(parsedHourlyRate ?? 0, currency, preferences.language),
              })}
            </Typography>
            <Button type="submit" isDisabled={Boolean(hourlyRateError)}>
              {t("Save billing rate")}
            </Button>
          </div>
        </Form>

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
