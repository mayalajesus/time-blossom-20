import { Button, Label, ListBox, Modal, Radio, RadioGroup, Select, toast } from "@heroui/react";
import { Check, Download, Loader2 } from "lucide-react";
import { useState } from "react";

type Phase = "idle" | "working" | "done";

export function ExportModal({
  isOpen,
  onOpenChange,
  scope,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  scope: string;
}) {
  const [format, setFormat] = useState("csv");
  const [range, setRange] = useState("this-week");
  const [phase, setPhase] = useState<Phase>("idle");

  const run = () => {
    setPhase("working");
    window.setTimeout(() => {
      setPhase("done");
      toast("Export ready", {
        description: `${scope}-${range}.${format} was generated (simulated).`,
      });
    }, 1400);
  };

  const close = (open: boolean) => {
    if (!open) setPhase("idle");
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
            <Modal.Body className="flex flex-col gap-5">
              <div className="space-y-2">
                <Label>Date range</Label>
                <Select
                  aria-label="Date range"
                  fullWidth
                  value={range}
                  onChange={(key) => setRange(String(key ?? "this-week"))}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {[
                        { id: "this-week", label: "This week" },
                        { id: "last-week", label: "Last week" },
                        { id: "this-month", label: "This month" },
                        { id: "all-time", label: "All time" },
                      ].map((item) => (
                        <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
                          <Label>{item.label}</Label>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <RadioGroup
                value={format}
                onChange={(next: string) => setFormat(next)}
                orientation="horizontal"
              >
                <Label>Format</Label>
                {["csv", "pdf", "json"].map((f) => (
                  <Radio key={f} value={f}>
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      {f.toUpperCase()}
                    </Radio.Content>
                  </Radio>
                ))}
              </RadioGroup>

              {phase === "done" ? (
                <div className="flex items-center gap-2 rounded-xl bg-success-subtle px-3 py-2 text-sm text-success">
                  <Check className="size-4" />
                  File generated — download simulated.
                </div>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Close
              </Button>
              <Button isDisabled={phase === "working"} onPress={run}>
                {phase === "working" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {phase === "working" ? "Preparing…" : "Export"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
