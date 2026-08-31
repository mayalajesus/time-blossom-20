export const defaultAvatarUrls = [
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg",
] as const;

export function getSessionDefaultAvatarUrl(userId: string) {
  const normalizedId = userId.replace(/-/g, "").toLowerCase();
  let hash = 0;
  for (const character of normalizedId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return defaultAvatarUrls[hash % defaultAvatarUrls.length] ?? defaultAvatarUrls[0];
}

export function isDefaultAvatarUrl(value: unknown): value is (typeof defaultAvatarUrls)[number] {
  return (
    typeof value === "string" &&
    defaultAvatarUrls.includes(value as (typeof defaultAvatarUrls)[number])
  );
}

export function resetSessionDefaultAvatar() {
  // Kept as a compatibility no-op for callers from the previous session-based implementation.
}
