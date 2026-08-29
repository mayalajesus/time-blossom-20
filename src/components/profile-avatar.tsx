import { Avatar } from "@heroui/react";
import { useState } from "react";
import type { Member } from "@/lib/mock-data";
import { getSessionDefaultAvatarUrl } from "@/lib/default-avatar";

export function ProfileAvatar({
  member,
  avatarUrl,
  size = "sm",
}: {
  member: Pick<Member, "name">;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [sessionDefaultAvatarUrl] = useState(getSessionDefaultAvatarUrl);

  return (
    <Avatar size={size}>
      <Avatar.Image alt={member.name} src={avatarUrl ?? sessionDefaultAvatarUrl} />
      <Avatar.Fallback aria-hidden="true" />
    </Avatar>
  );
}
