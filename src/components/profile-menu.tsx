import { Description, Dropdown, Label, toast } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, SlidersHorizontal } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";

export function ProfileMenu({ showName = false }: { showName?: boolean }) {
  const { currentMember, preferences, signOut } = useStore();
  const { t, error } = useI18n();
  const navigate = useNavigate();

  if (!currentMember) return null;

  const handleAction = (key: string) => {
    switch (key) {
      case "settings":
        navigate({ to: "/settings", hash: "account" });
        break;
      case "preferences":
        navigate({ to: "/settings", hash: "personal-preferences" });
        break;
      case "sign-out": {
        const result = signOut();
        if (!result.success) {
          toast(t("Could not sign out: {error}", { error: error(result.error) }));
        }
        break;
      }
    }
  };

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={t("Open account menu for {name}", { name: currentMember.name })}
        className={
          showName
            ? "flex h-11 w-full min-w-0 items-center justify-start gap-3 rounded-xl px-2 py-2 ring-offset-2 focus-visible:ring-2 focus-visible:ring-focus"
            : "h-9 w-9 min-w-9 rounded-full p-0 ring-offset-2 focus-visible:ring-2 focus-visible:ring-focus"
        }
      >
        <ProfileAvatar member={currentMember} avatarUrl={preferences.avatarUrl} />
        {showName ? (
          <span className="min-w-0 truncate text-left text-sm text-muted">
            {currentMember.name}
          </span>
        ) : null}
      </Dropdown.Trigger>
      <Dropdown.Popover
        placement={showName ? "right end" : "bottom end"}
        className="w-64 max-w-[calc(100vw-1.5rem)] p-1"
      >
        <div className="border-b border-default px-3 py-2">
          <p className="truncate text-sm font-medium text-foreground">{currentMember.name}</p>
          <p className="truncate text-xs text-muted">{currentMember.email}</p>
          <Description className="mt-1 text-xs">{t(currentMember.role)}</Description>
        </div>
        <Dropdown.Menu onAction={(key) => handleAction(String(key))}>
          <Dropdown.Item id="settings">
            <Settings className="size-4" />
            <Label>{t("Settings")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="preferences">
            <SlidersHorizontal className="size-4" />
            <Label>{t("Personal preferences")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="sign-out" className="text-danger">
            <LogOut className="size-4" />
            <Label>{t("Sign out")}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
