import { Description, Dropdown, Label, toast } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { Layers3, LogOut, Settings, SlidersHorizontal } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { signOut as signOutRemote } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";

export function ProfileMenu({
  showName = false,
  showRole = false,
}: {
  showName?: boolean;
  showRole?: boolean;
}) {
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
      case "workspaces":
        navigate({ to: "/workspaces" });
        break;
      case "preferences":
        navigate({ to: "/settings", hash: "personal-preferences" });
        break;
      case "sign-out": {
        const result = configured ? await signOutRemote() : signOut();
        if (!result.success) {
          toast(t("Could not sign out: {error}", { error: error(result.error) }));
        } else {
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
        <ProfileAvatar member={currentMember} avatarUrl={preferences.avatarUrl} />
        {showName ? (
          <span className="min-w-0 truncate">
            <span className="block truncate">{currentMember.name}</span>
            {showRole ? <span className="block truncate">{t(currentMember.role)}</span> : null}
          </span>
        ) : null}
      </Dropdown.Trigger>
      <Dropdown.Popover
        placement={showName ? "right" : "bottom"}
        className="w-64 max-w-[calc(100vw-1.5rem)] p-1"
      >
        <div className="px-3 py-2">
          <p className="truncate">{currentMember.name}</p>
          <p className="truncate">{currentMember.email}</p>
          <Description className="mt-1">{t(currentMember.role)}</Description>
        </div>
        <Dropdown.Menu onAction={(key) => handleAction(String(key))}>
          <Dropdown.Item id="workspaces">
            <Layers3 className="size-4" />
            <Label>{t("Workspaces")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="settings">
            <Settings className="size-4" />
            <Label>{t("Settings")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="preferences">
            <SlidersHorizontal className="size-4" />
            <Label>{t("Personal preferences")}</Label>
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
