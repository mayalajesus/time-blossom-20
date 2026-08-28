import { Button, Description, Form, Label, Modal, Radio, RadioGroup, toast } from "@heroui/react";
import { Download } from "lucide-react";
import { useState } from "react";
import { FormAlert } from "@/components/form-feedback";
import {
  exportReport,
  type ReportExportFormat,
  type ReportExportPayload,
} from "@/lib/report-export";

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

  const close = (open: boolean) => {
    if (!open) {
      setHasExported(false);
      setExportError("");
    }
    onOpenChange(open);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={close}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Export {scope}</Modal.Heading>
            </Modal.Header>
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                const result = exportReport(format, payload);
                if (!result.success) {
                  setHasExported(false);
                  setExportError(result.error);
                  return;
                }
                setHasExported(true);
                setExportError("");
                toast("Export started", {
                  description:
                    format === "pdf"
                      ? "A print-ready report opened for printing or saving as PDF."
                      : `The filtered ${format.toUpperCase()} report is downloading.`,
                });
              }}
            >
              <Modal.Body className="flex flex-col gap-5">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Included data</p>
                  <Description>
                    This export uses the current period, filters and report view (
                    {payload.rows.length} rows).
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
                  <Label>Format</Label>
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
                    title="Export prepared"
                    description={
                      format === "pdf"
                        ? "The print window is ready. Choose Save as PDF in the browser print dialog."
                        : "The file uses the same filtered dataset shown in this report."
                    }
                  />
                ) : null}
                {exportError ? (
                  <FormAlert status="danger" title="Export unavailable" description={exportError} />
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" type="button" variant="secondary">
                  Close
                </Button>
                <Button type="submit">
                  <Download className="size-4" />
                  Export
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
