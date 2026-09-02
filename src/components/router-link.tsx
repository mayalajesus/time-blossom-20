import { Link as HeroLink } from "@heroui/react/link";
import { createLink } from "@tanstack/react-router";

/**
 * Keeps TanStack Router navigation semantics while using HeroUI's link
 * behavior and visual defaults for visible route links.
 */
export const RouterLink = createLink(HeroLink);
