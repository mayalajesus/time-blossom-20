import { Avatar } from "@heroui/react";
import type { Member } from "@/lib/mock-data";
import { getSessionDefaultAvatarUrl } from "@/lib/default-avatar";

export function ProfileAvatar({
  member,
  avatarUrl,
  size = "sm",
}: {
  member: Pick<Member, "id" | "name">;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Avatar size={size}>
      <Avatar.Image alt={member.name} src={avatarUrl ?? getSessionDefaultAvatarUrl(member.id)} />
      <Avatar.Fallback aria-hidden="true" />
    </Avatar>
  );
}
