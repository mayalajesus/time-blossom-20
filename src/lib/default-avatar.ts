const defaultAvatarUrls = [
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg",
] as const;

const defaultAvatarStorageKey = "time-blossom:default-avatar:v1";

function randomDefaultAvatarUrl() {
  const index = Math.floor(Math.random() * defaultAvatarUrls.length);
  return defaultAvatarUrls[index] ?? defaultAvatarUrls[0];
}

export function getSessionDefaultAvatarUrl() {
  if (typeof window === "undefined") return defaultAvatarUrls[0];

  try {
    const stored = window.sessionStorage.getItem(defaultAvatarStorageKey);
    if (stored && defaultAvatarUrls.includes(stored as (typeof defaultAvatarUrls)[number])) {
      return stored;
    }

    const selected = randomDefaultAvatarUrl();
    window.sessionStorage.setItem(defaultAvatarStorageKey, selected);
    return selected;
  } catch {
    return randomDefaultAvatarUrl();
  }
}

export function resetSessionDefaultAvatar() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(defaultAvatarStorageKey);
  } catch {
    /* Memory fallback. */
  }
}
