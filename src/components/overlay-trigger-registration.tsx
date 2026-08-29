import { Drawer, Modal, Popover } from "@heroui/react";

const registrationClassName =
  "pointer-events-none fixed -z-10 size-px overflow-hidden opacity-0 [clip:rect(0,0,0,0)]";

/**
 * HeroUI's overlay roots are DialogTriggers. These registration triggers keep
 * controlled overlays connected to React Aria without adding another visible
 * control to the interface.
 */
export function ModalTriggerRegistration() {
  return <Modal.Trigger aria-hidden="true" className={registrationClassName} tabIndex={-1} />;
}

export function DrawerTriggerRegistration() {
  return <Drawer.Trigger aria-hidden="true" className={registrationClassName} isDisabled />;
}

export function PopoverTriggerRegistration() {
  return <Popover.Trigger aria-hidden="true" className={registrationClassName} tabIndex={-1} />;
}
