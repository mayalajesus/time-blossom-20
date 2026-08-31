import * as React from "react";
import * as RechartsPrimitive from "recharts";
import type { NameType, Payload, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { cn } from "../../lib/utils";

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
    theme?: Record<keyof typeof THEMES, string>;
  };
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used inside a ChartContainer");
  return context;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        data-slot="chart"
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted [&_.recharts-cartesian-grid_line]:stroke-divider [&_.recharts-curve.recharts-tooltip-cursor]:stroke-divider [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-divider [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-divider [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorEntries = Object.entries(config).filter(([, item]) => item.color || item.theme);
  if (!colorEntries.length) return null;

  const css = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const declarations = colorEntries
        .map(([key, item]) => {
          const color = item.theme?.[theme as keyof typeof THEMES] || item.color;
          return color ? `--color-${key}: ${color};` : null;
        })
        .filter(Boolean)
        .join(" ");
      return `${prefix} [data-chart=${id}] { ${declarations} }`;
    })
    .join(" ");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  hideLabel = false,
  hideSeriesLabel = false,
  indicator = "dot",
  valueFormatter,
  footerFormatter,
}: {
  active?: boolean;
  payload?: Array<Payload<ValueType, NameType>>;
  label?: React.ReactNode;
  className?: string;
  hideLabel?: boolean;
  hideSeriesLabel?: boolean;
  indicator?: "line" | "dot" | "dashed";
  valueFormatter?: (value: ValueType | undefined, name: NameType | undefined) => React.ReactNode;
  footerFormatter?: (payload: Array<Payload<ValueType, NameType>>) => React.ReactNode;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-divider bg-overlay px-2.5 py-1.5 text-xs shadow-lg",
        className,
      )}
    >
      {!hideLabel ? <div className="font-medium">{label}</div> : null}
      <div className="grid gap-1.5">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "value");
          const itemConfig = config[key];
          const color = item.color || itemConfig?.color;
          return (
            <div key={key} className="flex w-full items-center gap-2">
              {!hideSeriesLabel ? (
                <>
                  <span
                    className={cn(
                      "shrink-0",
                      indicator === "line" && "h-2.5 w-1",
                      indicator === "dot" && "size-2 rounded-full",
                      indicator === "dashed" && "w-0 border border-dashed bg-transparent",
                    )}
                    style={{ backgroundColor: indicator === "dashed" ? "transparent" : color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{itemConfig?.label || item.name}</span>
                </>
              ) : null}
              <span className="font-mono font-medium tabular-nums text-foreground">
                {valueFormatter ? valueFormatter(item.value, item.name) : String(item.value ?? "")}
              </span>
            </div>
          );
        })}
      </div>
      {footerFormatter ? <div className="pt-1">{footerFormatter(payload)}</div> : null}
    </div>
  );
}
