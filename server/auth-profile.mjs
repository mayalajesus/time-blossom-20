function cleanText(value, maxLength = 120) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function firstText(source, keys, maxLength = 120) {
  for (const key of keys) {
    const value = cleanText(source?.[key], maxLength);
    if (value) return value;
  }
  return "";
}

export function trustedGoogleAvatarUrl(value) {
  const candidate = cleanText(value, 2_048);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      (hostname === "googleusercontent.com" || hostname.endsWith(".googleusercontent.com"))
      ? candidate
      : null;
  } catch {
    return null;
  }
}

export function extractAuthIdentity({ id, email, name, metadata = {} }) {
  const declaredName = firstText(metadata, ["full_name", "name", "displayName"]);
  const declaredParts = declaredName.split(" ").filter(Boolean);
  const firstName =
    firstText(metadata, ["given_name", "first_name", "firstName"]) || declaredParts[0] || "";
  const lastName =
    firstText(metadata, ["family_name", "last_name", "lastName"]) ||
    declaredParts.slice(1).join(" ");
  const providerName = [firstName, lastName].filter(Boolean).join(" ");
  const avatarUrl = [metadata?.avatar_url, metadata?.picture]
    .map(trustedGoogleAvatarUrl)
    .find(Boolean);

  return {
    id: cleanText(id, 255),
    email: (cleanText(email, 320) || firstText(metadata, ["email"], 320)).toLowerCase(),
    name: providerName || declaredName || cleanText(name),
    firstName,
    lastName,
    avatarUrl: avatarUrl ?? null,
  };
}
