import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BillableIndicator } from "../../src/components/billable-indicator";
import { AppI18nProvider } from "../../src/lib/i18n";

function renderIndicator(
  props: Parameters<typeof BillableIndicator>[0],
  locale: "en-US" | "pt-BR" = "en-US",
) {
  return renderToStaticMarkup(
    createElement(AppI18nProvider, { locale }, createElement(BillableIndicator, props)),
  );
}

describe("billable indicator", () => {
  it("renders the billable chip with its semantic state and label", () => {
    const html = renderIndicator({ billable: true });

    expect(html).toContain('data-billable-state="billable"');
    expect(html).toContain("Billable");
    expect(html).toContain("chip--success");
  });

  it("renders internal icon-only states with accessible context", () => {
    const html = renderIndicator({ billable: false, mode: "icon" }, "pt-BR");

    expect(html).toContain('data-billable-state="internal"');
    expect(html).toContain('aria-label="Interno"');
    expect(html).toContain('title="Interno"');
  });

  it("renders a neutral icon for the billability filter state", () => {
    const html = renderIndicator({ billable: null, mode: "icon" });

    expect(html).toContain('data-billable-state="all"');
    expect(html).toContain('aria-label="Billability"');
  });
});
