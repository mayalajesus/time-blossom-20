import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function DataTableFrame({
  label,
  scrollHint,
  children,
  className,
}: {
  label: string;
  scrollHint: string;
  children: ReactNode;
  className?: string;
}) {
  const descriptionId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateScrollableState = () => {
      setIsScrollable(frame.scrollWidth > frame.clientWidth + 1);
    };

    updateScrollableState();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollableState);
    observer?.observe(frame);
    window.addEventListener("resize", updateScrollableState);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScrollableState);
    };
  }, []);

  return (
    <section
      className={`data-table-region ${className ?? ""}`.trim()}
      aria-label={label}
      aria-describedby={descriptionId}
    >
      <p id={descriptionId} className={`table-scroll-hint ${isScrollable ? "" : "sr-only"}`.trim()}>
        {scrollHint}
      </p>
      <div ref={frameRef} className="table-frame" tabIndex={isScrollable ? 0 : undefined}>
        {children}
      </div>
    </section>
  );
}
