import { AlertDialog } from "@heroui/react/alert-dialog";
import { Drawer } from "@heroui/react/drawer";
import { Modal } from "@heroui/react/modal";
import { Popover } from "@heroui/react/popover";

const registrationClassName = "sr-only";

/**
 * HeroUI's overlay roots are DialogTriggers. These registration triggers keep
 * controlled overlays connected to React Aria without adding another visible
 * control to the interface.
 */
export function ModalTriggerRegistration() {
  return (
    <Modal.Trigger aria-label="Modal trigger" className={registrationClassName} tabIndex={-1} />
  );
}

export function AlertDialogTriggerRegistration() {
  return (
    <AlertDialog.Trigger
      aria-label="Alert dialog trigger"
      className={registrationClassName}
      tabIndex={-1}
    />
  );
}

export function DrawerTriggerRegistration() {
  return (
    <Drawer.Trigger aria-label="Drawer trigger" className={registrationClassName} isDisabled />
  );
}

export function PopoverTriggerRegistration() {
  return (
    <Popover.Trigger aria-label="Popover trigger" className={registrationClassName} tabIndex={-1} />
  );
}
