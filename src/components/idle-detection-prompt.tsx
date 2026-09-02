import { Button } from "@heroui/react/button";
import { Modal } from "@heroui/react/modal";
import { useEffect, useRef, useState } from "react";
import { ModalLayout } from "@/components/modal-layout";
import { ModalTriggerRegistration } from "@/components/overlay-trigger-registration";
import { useI18n } from "@/lib/i18n";
import {
  createBrowserIdleDetectionClock,
  createIdleDetectionController,
  DEFAULT_IDLE_TIMEOUT_MS,
  type IdleDetectionController,
} from "@/lib/idle-detection";
import { useStore } from "@/lib/store";

export function IdleDetectionPrompt() {
  const { timer, preferences, pauseTimer } = useStore();
  const { t } = useI18n();
  const [idleStartedAt, setIdleStartedAt] = useState<number | null>(null);
  const controllerRef = useRef<IdleDetectionController | null>(null);
  const pauseTimerRef = useRef(pauseTimer);
  pauseTimerRef.current = pauseTimer;

  useEffect(() => {
    const controller = createIdleDetectionController(
      createBrowserIdleDetectionClock(),
      setIdleStartedAt,
      (effectiveAt) => pauseTimerRef.current(effectiveAt),
    );
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.update({
      enabled: preferences.idleDetection,
      timeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
      status: timer.status,
      startedAt: timer.startedAt,
    });
  }, [preferences.idleDetection, timer.startedAt, timer.status]);

  const continueWorking = () => controllerRef.current?.continueWorking();

  return (
    <Modal
      isOpen={idleStartedAt !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) continueWorking();
      }}
    >
      <ModalTriggerRegistration />
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <ModalLayout.Header>
              {t("You were inactive. Would you like to pause the timer?")}
            </ModalLayout.Header>
            <ModalLayout.Footer>
              <Button variant="tertiary" onPress={continueWorking}>
                {t("Continue working")}
              </Button>
              <Button onPress={() => controllerRef.current?.pause()}>{t("Pause timer")}</Button>
            </ModalLayout.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
