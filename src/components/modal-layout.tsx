import { Modal } from "@heroui/react/modal";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Header({ children, className, ...props }: ComponentProps<typeof Modal.Header>) {
  return (
    <Modal.Header className={cn("pb-2", className)} {...props}>
      <Modal.Heading className="text-lg font-semibold tracking-tight">{children}</Modal.Heading>
    </Modal.Header>
  );
}

function Body({ children, className, ...props }: ComponentProps<typeof Modal.Body>) {
  return (
    <Modal.Body className={cn("flex flex-col gap-5 py-2", className)} {...props}>
      {children}
    </Modal.Body>
  );
}

function Footer({ children, className, ...props }: ComponentProps<typeof Modal.Footer>) {
  return (
    <Modal.Footer className={cn("gap-2 pt-3", className)} {...props}>
      {children}
    </Modal.Footer>
  );
}

export const ModalLayout = { Header, Body, Footer };
