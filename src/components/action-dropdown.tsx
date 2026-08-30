import { Dropdown, Label } from "@heroui/react";
import type { ReactNode } from "react";
import { Ellipsis } from "@gravity-ui/icons";

export type ActionDropdownItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  tone?: "default" | "danger" | "warning";
  isDisabled?: boolean;
};

export function ActionDropdown({
  ariaLabel,
  items,
  onAction,
}: {
  ariaLabel: string;
  items: readonly ActionDropdownItem[];
  onAction: (id: string) => void;
}) {
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={ariaLabel} className="h-8 w-8 min-w-8 shrink-0 p-0">
        <Ellipsis className="size-4" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="max-w-[calc(100vw-1.5rem)] min-w-48">
        <Dropdown.Menu onAction={(key) => onAction(String(key))}>
          {items.map((item) => (
            <Dropdown.Item
              key={item.id}
              id={item.id}
              {...(item.isDisabled ? { isDisabled: true } : {})}
              {...(item.tone === "danger" ? { variant: "danger" as const } : {})}
            >
              {item.icon ? (
                <span
                  className={
                    item.tone === "danger"
                      ? "text-danger"
                      : item.tone === "warning"
                        ? "text-warning"
                        : undefined
                  }
                >
                  {item.icon}
                </span>
              ) : null}
              <Label className={item.tone === "warning" ? "text-warning" : undefined}>
                {item.label}
              </Label>
              {item.trailing ? (
                <span className="ml-auto flex shrink-0 items-center">{item.trailing}</span>
              ) : null}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
