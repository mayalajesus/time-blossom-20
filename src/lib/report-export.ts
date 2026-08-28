import * as XLSX from "xlsx";
import { defaultLocale, translate, type Locale } from "@/lib/i18n";

export type ReportExportFormat = "csv" | "xlsx" | "pdf";

export type ReportExportMeta = {
  label: string;
  value: string;
};

export type ReportExportSummaryItem = {
  label: string;
  value: string;
};

export type ReportExportPayload = {
  /** Stable filename stem. */
  title: string;
  /** Human-readable title used by the print-ready report. */
  displayTitle?: string;
  subtitle?: string;
  meta?: ReportExportMeta[];
  summary?: ReportExportSummaryItem[];
  columns: string[];
  rows: Array<Record<string, string | number>>;
  locale?: Locale;
  branding?: {
    workspaceName: string;
    logoDataUrl: string | null;
  };
};

export type ReportExportResult = { success: true } | { success: false; error: string };

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(payload: ReportExportPayload): ReportExportResult {
  try {
    const rows = [
      payload.columns,
      ...payload.rows.map((row) => payload.columns.map((column) => row[column] ?? "")),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`;
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${payload.title}.csv`);
    return { success: true };
  } catch {
    return {
      success: false,
      error: translate("The CSV export could not be prepared.", payload.locale),
    };
  }
}

function exportXlsx(payload: ReportExportPayload): ReportExportResult {
  try {
    const worksheet = XLSX.utils.json_to_sheet(payload.rows, { header: payload.columns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${payload.title}.xlsx`);
    return { success: true };
  } catch {
    return {
      success: false,
      error: translate("The Excel export could not be prepared.", payload.locale),
    };
  }
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function humanizeTitle(value: string): string {
  const text = value
    .replace(/^time-blossom[-_]?/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!text) return "Time report";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} report`;
}

function renderMeta(meta: ReportExportMeta[] | undefined): string {
  if (!meta?.length) return "";
  return `<dl class="meta">${meta
    .map(
      (item) =>
        `<div class="meta-item"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`,
    )
    .join("")}</dl>`;
}

function renderSummary(summary: ReportExportSummaryItem[] | undefined, rowCount: number): string {
  const items = summary?.length ? summary : [{ label: "Records", value: String(rowCount) }];
  return `<section class="summary" aria-label="Report totals">${items
    .map(
      (item) =>
        `<div class="summary-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`,
    )
    .join("")}</section>`;
}

function renderTable(payload: ReportExportPayload): string {
  const columns = payload.columns.length ? payload.columns : ["Details"];
  const header = columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join("");
  const body = payload.rows.length
    ? payload.rows
        .map(
          (row) =>
            `<tr>${columns
              .map((column) => `<td>${escapeHtml(row[column] ?? "—")}</td>`)
              .join("")}</tr>`,
        )
        .join("")
    : `<tr><td class="empty" colspan="${columns.length}">${escapeHtml(translate("No records match the selected report.", payload.locale))}</td></tr>`;

  return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function printableMarkup(payload: ReportExportPayload): string {
  const locale = payload.locale ?? defaultLocale;
  const title = payload.displayTitle ?? humanizeTitle(payload.title);
  const subtitle = payload.subtitle ?? translate("Time Blossom · filtered report", locale);
  const workspaceName = payload.branding?.workspaceName?.trim() || "Time Blossom";
  const brandMark = payload.branding?.logoDataUrl
    ? `<img class="brand-logo" src="${escapeHtml(payload.branding.logoDataUrl)}" alt="" />`
    : `<span class="brand-mark">TB</span>`;
  const generatedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #17202a;
        background: #ffffff;
      }
      @page { size: A4 landscape; margin: 13mm 12mm 15mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-size: 10px; line-height: 1.4; }
      .report { max-width: 1200px; margin: 0 auto; }
      .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding-bottom: 15px; border-bottom: 2px solid #1f2937; }
      .brand { display: flex; align-items: center; gap: 9px; color: #0d8cf0; font-weight: 800; letter-spacing: .02em; }
      .brand-mark { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 7px; color: #fff; background: #0d8cf0; font-size: 11px; }
      .brand-logo { display: block; width: 22px; height: 22px; border-radius: 7px; object-fit: cover; }
      h1 { margin: 13px 0 3px; color: #111827; font-size: 22px; line-height: 1.15; letter-spacing: -.02em; }
      .subtitle { margin: 0; color: #667085; font-size: 11px; }
      .generated { margin: 2px 0 0; color: #667085; font-size: 9px; text-align: right; }
      .meta { display: flex; flex-wrap: wrap; gap: 6px 22px; margin: 13px 0 12px; padding: 0; }
      .meta-item { display: flex; gap: 5px; margin: 0; }
      .meta dt { color: #667085; font-weight: 600; }
      .meta dd { margin: 0; color: #1f2937; font-weight: 600; }
      .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 0 0 15px; }
      .summary-item { min-height: 49px; padding: 9px 11px; border: 1px solid #d9e0e8; border-radius: 8px; background: #f7f9fb; }
      .summary-item span { display: block; color: #667085; font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
      .summary-item strong { display: block; margin-top: 3px; color: #111827; font-size: 15px; }
      .table-wrap { overflow: hidden; border: 1px solid #cfd7e2; border-radius: 8px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { padding: 7px 8px; border-bottom: 1px solid #e3e8ef; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      th { color: #526071; background: #eef2f6; font-size: 8px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
      td { color: #273444; font-size: 9px; }
      tbody tr:nth-child(even) td { background: #fbfcfd; }
      tbody tr:last-child td { border-bottom: 0; }
      .empty { padding: 28px 12px; color: #667085; text-align: center; }
      .footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 11px; color: #8994a3; font-size: 8px; }
      @media print {
        .table-wrap { overflow: visible; }
        tr { break-inside: avoid; }
        thead { display: table-header-group; }
      }
    </style>
  </head>
  <body>
    <main class="report">
      <header class="header">
        <div>
          <div class="brand">${brandMark}<span>${escapeHtml(workspaceName)}</span></div>
          <h1>${escapeHtml(title)}</h1>
          <p class="subtitle">${escapeHtml(subtitle)}</p>
        </div>
        <p class="generated">${escapeHtml(translate("Generated", locale))} ${escapeHtml(generatedAt)}</p>
      </header>
      ${renderMeta(payload.meta)}
      ${renderSummary(payload.summary, payload.rows.length)}
      ${renderTable(payload)}
      <footer class="footer"><span>${escapeHtml(translate("Time Blossom · report export", locale))}</span><span>${payload.rows.length} ${escapeHtml(translate("records", locale))}</span></footer>
    </main>
  </body>
</html>`;
}

function printInWindow(markup: string): ReportExportResult | null {
  const printWindow = window.open("", "_blank", "width=1280,height=900");
  if (!printWindow) return null;

  try {
    printWindow.document.open();
    printWindow.document.write(markup);
    printWindow.document.close();
    let hasPrinted = false;
    const print = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      printWindow.focus();
      printWindow.print();
    };
    printWindow.setTimeout(print, 250);
    return { success: true };
  } catch {
    printWindow.close();
    return { success: false, error: "The PDF print preview could not be prepared." };
  }
}

function printInFrame(markup: string): ReportExportResult {
  try {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.top = "0";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.border = "0";
    frame.style.opacity = "0";
    document.body.appendChild(frame);
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) {
      frame.remove();
      return { success: false, error: "The PDF print preview could not be opened." };
    }
    frameDocument.open();
    frameDocument.write(markup);
    frameDocument.close();
    frameWindow.setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      window.setTimeout(() => frame.remove(), 1000);
    }, 250);
    return { success: true };
  } catch {
    return { success: false, error: "The PDF print preview could not be opened." };
  }
}

function printPdf(payload: ReportExportPayload): ReportExportResult {
  const markup = printableMarkup(payload);
  return printInWindow(markup) ?? printInFrame(markup);
}

export function exportReport(
  format: ReportExportFormat,
  payload: ReportExportPayload,
): ReportExportResult {
  if (format === "csv") return exportCsv(payload);
  if (format === "xlsx") return exportXlsx(payload);
  return printPdf(payload);
}
