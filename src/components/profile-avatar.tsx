import { Avatar } from "@heroui/react";
import type { Member } from "@/lib/mock-data";

export function ProfileAvatar({
  member,
  avatarUrl,
  size = "sm",
}: {
  member: Pick<Member, "name" | "initials">;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Avatar size={size}>
      {avatarUrl ? <Avatar.Image alt={member.name} src={avatarUrl} /> : null}
      <Avatar.Fallback aria-hidden="true" />
    </Avatar>
  );
}
