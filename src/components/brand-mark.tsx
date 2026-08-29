import { Avatar } from "@heroui/react";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Avatar aria-label="Time Blossom" className={className}>
      <Avatar.Image alt="Time Blossom" src="/brand/orbit-symbol.png" />
      <Avatar.Fallback aria-hidden="true">TB</Avatar.Fallback>
    </Avatar>
  );
}
