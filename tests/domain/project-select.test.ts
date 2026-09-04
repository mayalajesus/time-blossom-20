import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectSelect } from "../../src/components/project-select";
import { AppI18nProvider } from "../../src/lib/i18n";

vi.mock("../../src/lib/store", () => ({
  useStore: () => ({
    projects: [
      {
        id: "p1",
        name: "Tracking",
        clientId: "c1",
        status: "active",
        color: "bg-accent",
      },
    ],
    clients: [{ id: "c1", name: "Daten" }],
    canTrackProject: () => true,
  }),
}));

function renderSelectedValue(value: string, showClientName: boolean) {
  const html = renderToStaticMarkup(
    createElement(AppI18nProvider, {
      locale: "en-US",
      children: createElement(ProjectSelect, {
        value,
        showClientName,
        ariaLabel: "Project",
        onChange: () => undefined,
      }),
    }),
  );
  const start = html.indexOf('data-slot="autocomplete-value"');
  const end = html.indexOf('data-slot="autocomplete-default-indicator"', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe("closed project selector", () => {
  it("shows the project and a muted client side by side in the trackerbar", () => {
    const html = renderSelectedValue("p1", true);

    expect(html).toContain('title="Tracking — Daten"');
    expect(html).toContain("flex min-w-0 items-center gap-2");
    expect(html).toContain("max-w-[60%] shrink-0");
    expect(html).toContain('class="min-w-0 truncate text-xs text-muted">Daten</span>');
    expect(html).not.toContain("flex-col");
  });

  it("keeps the no-project selection without a client label", () => {
    const html = renderSelectedValue("none", true);

    expect(html).toContain("No project");
    expect(html).not.toContain("Daten");
    expect(html).not.toContain("Unknown client");
  });

  it("does not add the client to selectors outside the trackerbar", () => {
    const html = renderSelectedValue("p1", false);

    expect(html).toContain("Tracking");
    expect(html).not.toContain(">Daten</span>");
    expect(html).not.toContain('title="Tracking — Daten"');
  });
});
