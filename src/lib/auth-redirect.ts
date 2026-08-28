const DEFAULT_AUTH_RETURN_PATH = "/tracker";

export function getAuthReturnPath(fallback = DEFAULT_AUTH_RETURN_PATH): string {
  if (typeof window === "undefined") return fallback;
  const redirect = new URLSearchParams(window.location.search).get("redirect");
  return redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : fallback;
}

export function getLoginPath(): string {
  if (typeof window === "undefined") return "/login";
  const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?redirect=${encodeURIComponent(returnPath)}`;
}
