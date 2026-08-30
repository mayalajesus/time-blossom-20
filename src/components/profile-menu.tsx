import { Description, Dropdown, Label, toast, Typography } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { signOut as signOutRemote } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { resetSessionDefaultAvatar } from "@/lib/default-avatar";

export function ProfileMenu({ showName = false }: { showName?: boolean }) {
  const { currentMember, preferences, signOut } = useStore();
  const { configured } = useAuth();
  const { t, error } = useI18n();
  const navigate = useNavigate();

  if (!currentMember) return null;

  const handleAction = async (key: string) => {
    switch (key) {
      case "settings":
        navigate({ to: "/settings", hash: "account" });
        break;
      case "sign-out": {
        const result = configured ? await signOutRemote() : signOut();
        if (!result.success) {
          toast(t("Could not sign out: {error}", { error: error(result.error) }));
        } else {
          resetSessionDefaultAvatar();
          void navigate({ to: "/login", replace: true });
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
            ? "flex h-11 w-full min-w-0 items-center justify-start gap-3 px-2 py-2 text-left"
            : "flex h-10 w-10 min-w-10 items-center justify-center p-0"
        }
      >
        <ProfileAvatar member={currentMember} avatarUrl={preferences.avatarUrl} size="sm" />
        {showName ? (
          <span className="min-w-0 truncate">
            <Typography type="body-sm" weight="semibold" truncate>
              {currentMember.name}
            </Typography>
          </span>
        ) : null}
      </Dropdown.Trigger>
      <Dropdown.Popover
        placement={showName ? "right" : "bottom"}
        className="w-64 max-w-[calc(100vw-1.5rem)] p-1"
      >
        <div className="px-3 py-2">
          <Typography type="body-sm" weight="semibold" truncate>
            {currentMember.name}
          </Typography>
          <Typography type="body-xs" color="muted" truncate>
            {currentMember.email}
          </Typography>
          <Description className="mt-1">{t(currentMember.role)}</Description>
        </div>
        <Dropdown.Menu onAction={(key) => handleAction(String(key))}>
          <Dropdown.Item id="settings">
            <Settings className="size-4" />
            <Label>{t("Settings")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="sign-out" variant="danger">
            <LogOut className="size-4" />
            <Label>{t("Sign out")}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
