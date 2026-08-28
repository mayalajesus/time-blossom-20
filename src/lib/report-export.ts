import * as XLSX from "xlsx";

export type ReportExportFormat = "csv" | "xlsx" | "pdf";

export type ReportExportPayload = {
  title: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
};

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(payload: ReportExportPayload): void {
  const rows = [
    payload.columns,
    ...payload.rows.map((row) => payload.columns.map((column) => row[column] ?? "")),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${payload.title}.csv`);
}

function exportXlsx(payload: ReportExportPayload): void {
  const worksheet = XLSX.utils.json_to_sheet(payload.rows, { header: payload.columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${payload.title}.xlsx`);
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printPdf(payload: ReportExportPayload): void {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return;

  const header = payload.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = payload.rows
    .map(
      (row) =>
        `<tr>${payload.columns.map((column) => `<td>${escapeHtml(row[column] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");

  printWindow.document.write(`<!doctype html>
    <html><head><title>${escapeHtml(payload.title)}</title>
    <style>
      @page { size: landscape; margin: 16mm; }
      body { font: 12px Arial, sans-serif; color: #111; }
      h1 { font-size: 18px; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #d7dce3; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #eef1f5; font-weight: 600; }
      tr:nth-child(even) td { background: #fafbfc; }
    </style></head><body>
    <h1>${escapeHtml(payload.title)}</h1>
    <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 150);
}

export function exportReport(format: ReportExportFormat, payload: ReportExportPayload): void {
  if (format === "csv") exportCsv(payload);
  if (format === "xlsx") exportXlsx(payload);
  if (format === "pdf") printPdf(payload);
}
