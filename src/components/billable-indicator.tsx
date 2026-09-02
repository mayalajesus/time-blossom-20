import { Chip } from "@heroui/react/chip";
import { CircleDollar } from "@gravity-ui/icons";
import { useI18n } from "../lib/i18n";
import { cn } from "../lib/utils";

export type BillableIndicatorMode = "chip" | "icon";
export type BillableIndicatorSize = "sm" | "md";

export function BillableIndicator({
  billable,
  mode = "chip",
  size = "sm",
  className,
}: {
  billable: boolean | null;
  mode?: BillableIndicatorMode;
  size?: BillableIndicatorSize;
  className?: string;
}) {
  const { t } = useI18n();
  const label = t(billable === null ? "Billability" : billable ? "Billable" : "Internal");
  const iconSize = size === "md" ? "size-4" : "size-3.5";
  const state = billable === null ? "all" : billable ? "billable" : "internal";
  const icon = <CircleDollar aria-hidden="true" className={iconSize} />;

  if (mode === "icon") {
    return (
      <span
        aria-label={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          billable === true ? "text-success" : "text-muted",
          className,
        )}
        data-billable-state={state}
        role="img"
        title={label}
      >
        {icon}
      </span>
    );
  }

  return (
    <Chip
      aria-label={label}
      {...(className ? { className } : {})}
      color={billable === true ? "success" : "default"}
      data-billable-state={state}
      size={size}
      variant="soft"
    >
      {icon}
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
