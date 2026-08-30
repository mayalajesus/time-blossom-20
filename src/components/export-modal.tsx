import {
  Button,
  Description,
  Form,
  Label,
  Modal,
  Radio,
  RadioGroup,
  Typography,
  toast,
} from "@heroui/react";
import { ArrowDownToLine } from "@gravity-ui/icons";
import { useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import { ModalTriggerRegistration } from "@/components/overlay-trigger-registration";
import {
  exportReport,
  type ReportExportFormat,
  type ReportExportPayload,
} from "@/lib/report-export";
import { useI18n } from "@/lib/i18n";

export function ExportModal({
  isOpen,
  onOpenChange,
  scope,
  payload,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  scope: string;
  payload: ReportExportPayload;
}) {
  const [format, setFormat] = useState<ReportExportFormat>("csv");
  const [hasExported, setHasExported] = useState(false);
  const [exportError, setExportError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const { t, error } = useI18n();

  const close = (open: boolean) => {
    if (!open) {
      setHasExported(false);
      setExportError("");
      setIsExporting(false);
    }
    onOpenChange(open);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={close}>
      <ModalTriggerRegistration />
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t("Export {scope}", { scope })}</Modal.Heading>
            </Modal.Header>
            <Form
              onSubmit={async (event) => {
                event.preventDefault();
                setIsExporting(true);
                try {
                  const result = await exportReport(format, payload);
                  if (!result.success) {
                    setHasExported(false);
                    setExportError(error(result.error));
                    return;
                  }
                  setHasExported(true);
                  setExportError("");
                  toast.success(t("Your export is ready"), {
                    description:
                      format === "pdf"
                        ? t("The PDF report has been downloaded.")
                        : t("The filtered {format} report is downloading.", {
                            format: format.toUpperCase(),
                          }),
                  });
                } finally {
                  setIsExporting(false);
                }
              }}
            >
              <Modal.Body className="flex flex-col gap-5">
                <div className="space-y-1">
                  <Typography type="body-sm" weight="semibold">
                    {t("Included data")}
                  </Typography>
                  <Description>
                    {t(
                      "This export uses the current period, filters and report view ({count} rows).",
                      {
                        count: payload.rows.length,
                      },
                    )}
                  </Description>
                </div>
                <RadioGroup
                  value={format}
                  onChange={(next: string) => {
                    setFormat(next as ReportExportFormat);
                    setExportError("");
                  }}
                  orientation="horizontal"
                >
                  <Label>{t("Format")}</Label>
                  {(["csv", "xlsx", "pdf"] as const).map((item) => (
                    <Radio key={item} value={item}>
                      <Radio.Content>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        {item.toUpperCase()}
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
                {hasExported ? (
                  <FormAlert
                    status="success"
                    title={t("Your export is ready")}
                    description={
                      format === "pdf"
                        ? t(
                            "The PDF report was downloaded with the current filters and workspace branding.",
                          )
                        : t("The file uses the same filtered dataset shown in this report.")
                    }
                  />
                ) : null}
                {exportError ? (
                  <FormAlert
                    status="danger"
                    title={t("We couldn't prepare the export")}
                    description={exportError}
                  />
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" type="button" variant="secondary">
                  {t("Close")}
                </Button>
                <Button type="submit" isDisabled={isExporting}>
                  <ArrowDownToLine className="size-4" />
                  {t("Export")}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
