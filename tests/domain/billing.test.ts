import { describe, expect, it } from "vitest";
import {
  billableValue,
  billingForEntry,
  defaultCurrencyForLocale,
  formatMoney,
  formatMoneyTotals,
  parseHourlyRateInput,
  sumBillableValues,
} from "../../src/lib/billing";

describe("hourly billing", () => {
  it("accepts a zero hourly rate", () => {
    expect(parseHourlyRateInput("0.00")).toBe(0);
    expect(
      billableValue({ billable: true, seconds: 3_600 }, { hourlyRate: 0, currency: "BRL" }),
    ).toBe(0);
  });

  it("preserves the entry rate after the current preference changes", () => {
    const historical = {
      billable: true,
      seconds: 7_200,
      hourlyRate: 50,
      currency: "BRL" as const,
    };
    const current = { hourlyRate: 100, currency: "USD" as const };

    expect(billingForEntry(historical, current)).toEqual({ hourlyRate: 50, currency: "BRL" });
    expect(billableValue(historical, current)).toBe(100);
    expect(billingForEntry({ billable: true, seconds: 3_600 }, current)).toEqual(current);
  });

  it("calculates billable entries and excludes internal entries", () => {
    const fallback = { hourlyRate: 120, currency: "BRL" as const };
    const entries = [
      { billable: true, seconds: 5_400 },
      { billable: false, seconds: 7_200 },
    ];
    const totals = sumBillableValues(entries, () => fallback);

    expect(totals).toEqual({ BRL: 180 });
    expect(billableValue(entries[1]!, fallback)).toBe(0);
  });

  it("formats each configured currency without conversion", () => {
    expect(defaultCurrencyForLocale("pt-BR")).toBe("BRL");
    expect(defaultCurrencyForLocale("en-US")).toBe("USD");
    expect(formatMoney(1234.5, "BRL", "pt-BR")).toContain("1.234,50");
    expect(formatMoney(1234.5, "USD", "en-US")).toContain("1,234.50");
    expect(formatMoneyTotals({ BRL: 100, USD: 25 }, "en-US")).toContain("$25.00");
  });

  it("rejects empty, negative and invalid hourly-rate input", () => {
    expect(parseHourlyRateInput("")).toBeNull();
    expect(parseHourlyRateInput("-1")).toBeNull();
    expect(parseHourlyRateInput("12abc")).toBeNull();
    expect(parseHourlyRateInput("12.345")).toBeNull();
  });
});
