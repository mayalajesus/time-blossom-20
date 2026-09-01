import { Button, Dropdown, Label } from "@heroui/react";
import { ChevronDown } from "@gravity-ui/icons";

export type ModalSelectOption = {
  id: string;
  label: string;
  isDisabled?: boolean;
};

export function ModalSelect({
  label,
  buttonAriaLabel = label,
  value,
  options,
  onChange,
}: {
  label: string;
  buttonAriaLabel?: string;
  value: string;
  options: readonly ModalSelectOption[];
  onChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.id === value)?.label ?? label;

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Dropdown>
        <Button
          type="button"
          variant="secondary"
          aria-label={buttonAriaLabel}
          className="h-9 w-full justify-between gap-2 px-3"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
        </Button>
        <Dropdown.Popover
          className="max-w-[calc(100vw-2rem)] min-w-0"
          style={{ width: "var(--trigger-width)", maxWidth: "calc(100vw - 2rem)" }}
        >
          <Dropdown.Menu
            aria-label={label}
            className="max-h-60 overflow-y-auto"
            selectionMode="single"
            selectedKeys={new Set([value])}
            onAction={(key) => onChange(String(key))}
          >
            {options.map((option) => (
              <Dropdown.Item
                key={option.id}
                id={option.id}
                textValue={option.label}
                isDisabled={option.isDisabled}
              >
                <Label>{option.label}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
