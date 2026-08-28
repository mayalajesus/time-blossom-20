export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/orbit-symbol.png"
      alt=""
      aria-hidden="true"
      className={className}
      draggable="false"
    />
  );
}
