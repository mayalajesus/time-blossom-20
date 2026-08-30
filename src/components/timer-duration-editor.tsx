import { Input, Label, TextField } from "@heroui/react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type TimerPart = "hours" | "minutes" | "seconds";

type TimerParts = Record<TimerPart, string>;

function getTimerParts(totalSeconds: number): TimerParts {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return {
    hours: String(Math.floor(seconds / 3600)).padStart(2, "0"),
    minutes: String(Math.floor((seconds % 3600) / 60)).padStart(2, "0"),
    seconds: String(seconds % 60).padStart(2, "0"),
  };
}

function getTimerSeconds(parts: TimerParts): number {
  const hours = Number(parts.hours) || 0;
  const minutes = Math.min(59, Number(parts.minutes) || 0);
  const seconds = Math.min(59, Number(parts.seconds) || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function TimerPartField({
  label,
  part,
  value,
  maxLength,
  isReadOnly,
  onFocus,
  onChange,
  onCommit,
}: {
  label: string;
  part: TimerPart;
  value: string;
  maxLength: number;
  isReadOnly: boolean;
  onFocus: (part: TimerPart) => void;
  onChange: (part: TimerPart, value: string) => void;
  onCommit: (part: TimerPart) => void;
}) {
  return (
    <TextField className="w-10 min-w-10 shrink-0" name={`timer-${part}`}>
      <Label className="sr-only">{label}</Label>
      <Input
        aria-label={label}
        inputMode="numeric"
        readOnly={isReadOnly}
        maxLength={maxLength}
        variant="secondary"
        value={value}
        className="px-1 text-center"
        onFocus={() => onFocus(part)}
        onChange={(event) =>
          onChange(part, event.currentTarget.value.replace(/\D/g, "").slice(0, maxLength))
        }
        onBlur={() => onCommit(part)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
        }}
      />
    </TextField>
  );
}

export function TimerDurationEditor({
  elapsed,
  isReadOnly,
  onElapsedChange,
}: {
  elapsed: number;
  isReadOnly: boolean;
  onElapsedChange: (seconds: number) => void;
}) {
  const { t } = useI18n();
  const [editingPart, setEditingPart] = useState<TimerPart | null>(null);
  const [draftParts, setDraftParts] = useState<TimerParts>(() => getTimerParts(elapsed));
  const timerParts = getTimerParts(elapsed);

  useEffect(() => {
    if (editingPart === null) setDraftParts(getTimerParts(elapsed));
  }, [editingPart, elapsed]);

  const handleFocus = (part: TimerPart) => {
    if (isReadOnly) return;
    setDraftParts((current) => ({ ...timerParts, [part]: current[part] || timerParts[part] }));
    setEditingPart(part);
  };

  const handleChange = (part: TimerPart, value: string) => {
    setDraftParts((current) => ({ ...current, [part]: value }));
  };

  const handleCommit = (part: TimerPart) => {
    if (isReadOnly || editingPart !== part) return;
    const nextParts = {
      ...timerParts,
      ...draftParts,
      [part]: draftParts[part] || "0",
    };
    onElapsedChange(getTimerSeconds(nextParts));
    setEditingPart(null);
  };

  return (
    <div
      className="flex shrink-0 items-center gap-0.5 whitespace-nowrap"
      aria-atomic="true"
      aria-live="polite"
      aria-label={`${t("Timer")}: ${getTimerParts(elapsed).hours}:${getTimerParts(elapsed).minutes}:${getTimerParts(elapsed).seconds}`}
    >
      <TimerPartField
        label={t("Hours")}
        part="hours"
        value={editingPart === "hours" ? draftParts.hours : timerParts.hours}
        maxLength={3}
        isReadOnly={isReadOnly}
        onFocus={handleFocus}
        onChange={handleChange}
        onCommit={handleCommit}
      />
      <span aria-hidden="true">:</span>
      <TimerPartField
        label={t("Minutes")}
        part="minutes"
        value={editingPart === "minutes" ? draftParts.minutes : timerParts.minutes}
        maxLength={2}
        isReadOnly={isReadOnly}
        onFocus={handleFocus}
        onChange={handleChange}
        onCommit={handleCommit}
      />
      <span aria-hidden="true">:</span>
      <TimerPartField
        label={t("Seconds")}
        part="seconds"
        value={editingPart === "seconds" ? draftParts.seconds : timerParts.seconds}
        maxLength={2}
        isReadOnly={isReadOnly}
        onFocus={handleFocus}
        onChange={handleChange}
        onCommit={handleCommit}
      />
    </div>
  );
}
