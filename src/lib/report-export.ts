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
  /** Human-readable title used by the downloaded report. */
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

function truncatePdfText(
  value: string | number,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  size: number,
  maxWidth: number,
): string {
  const text = String(value ?? "—");
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

function dataUrlBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const header = dataUrl.slice(0, comma);
  const value = dataUrl.slice(comma + 1);
  const mime = header.match(/^data:([^;]+)/i)?.[1]?.toLowerCase() ?? "";
  if (!header.toLowerCase().includes(";base64") || !value || !mime) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { bytes, mime };
  } catch {
    return null;
  }
}

async function exportPdf(payload: ReportExportPayload): Promise<ReportExportResult> {
  try {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [841.89, 595.28];
    const margin = 34;
    const ink = rgb(0.09, 0.12, 0.17);
    const muted = rgb(0.38, 0.43, 0.5);
    const accent = rgb(0.05, 0.55, 0.94);
    const border = rgb(0.82, 0.85, 0.89);
    const soft = rgb(0.96, 0.97, 0.98);
    const title = payload.displayTitle ?? "Time report";
    const workspaceName = payload.branding?.workspaceName?.trim() || "Time Blossom";
    const generatedAt = new Intl.DateTimeFormat(payload.locale ?? defaultLocale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
    pdf.setTitle(title);
    pdf.setAuthor(workspaceName);
    pdf.setSubject(payload.subtitle ?? "Time report");

    let logo:
      Awaited<ReturnType<typeof pdf.embedPng>> | Awaited<ReturnType<typeof pdf.embedJpg>> | null =
      null;
    const logoData = payload.branding?.logoDataUrl
      ? dataUrlBytes(payload.branding.logoDataUrl)
      : null;
    if (logoData?.mime === "image/png") logo = await pdf.embedPng(logoData.bytes);
    if (logoData?.mime === "image/jpeg" || logoData?.mime === "image/jpg") {
      logo = await pdf.embedJpg(logoData.bytes);
    }

    const drawHeader = (page: ReturnType<typeof pdf.addPage>, pageNumber: number) => {
      const { width, height } = page.getSize();
      if (logo) {
        page.drawImage(logo, { x: margin, y: height - margin - 26, width: 26, height: 26 });
      } else {
        page.drawRectangle({
          x: margin,
          y: height - margin - 26,
          width: 26,
          height: 26,
          color: accent,
        });
        page.drawText("TB", {
          x: margin + 5,
          y: height - margin - 18,
          size: 9,
          font: bold,
          color: rgb(1, 1, 1),
        });
      }
      page.drawText(workspaceName, {
        x: margin + 36,
        y: height - margin - 17,
        size: 12,
        font: bold,
        color: accent,
      });
      page.drawText(title, {
        x: margin,
        y: height - margin - 55,
        size: 21,
        font: bold,
        color: ink,
      });
      page.drawText(payload.subtitle ?? "Time Blossom · filtered report", {
        x: margin,
        y: height - margin - 73,
        size: 9,
        font: regular,
        color: muted,
      });
      page.drawText(`${translate("Generated", payload.locale)} ${generatedAt}`, {
        x: width - margin - 180,
        y: height - margin - 17,
        size: 8,
        font: regular,
        color: muted,
      });
      page.drawLine({
        start: { x: margin, y: height - margin - 86 },
        end: { x: width - margin, y: height - margin - 86 },
        thickness: 1.2,
        color: ink,
      });
      page.drawText(`${translate("Page", payload.locale)} ${pageNumber}`, {
        x: width - margin - 45,
        y: 18,
        size: 8,
        font: regular,
        color: muted,
      });
    };

    const drawContext = (page: ReturnType<typeof pdf.addPage>) => {
      const { width, height } = page.getSize();
      let y = height - margin - 104;
      for (const item of payload.meta ?? []) {
        const label = `${item.label}:`;
        const value = truncatePdfText(item.value, regular, 8, width - margin * 2 - 120);
        page.drawText(label, { x: margin, y, size: 8, font: bold, color: muted });
        page.drawText(value, { x: margin + 54, y, size: 8, font: regular, color: ink });
        y -= 13;
      }
      const summary = payload.summary ?? [{ label: "Records", value: String(payload.rows.length) }];
      const boxGap = 8;
      const boxWidth = (width - margin * 2 - boxGap * (summary.length - 1)) / summary.length;
      const boxY = y - 38;
      summary.forEach((item, index) => {
        const x = margin + index * (boxWidth + boxGap);
        page.drawRectangle({
          x,
          y: boxY,
          width: boxWidth,
          height: 32,
          color: soft,
          borderColor: border,
          borderWidth: 0.7,
        });
        page.drawText(item.label.toUpperCase(), {
          x: x + 8,
          y: boxY + 19,
          size: 7,
          font: bold,
          color: muted,
        });
        page.drawText(truncatePdfText(item.value, bold, 12, boxWidth - 16), {
          x: x + 8,
          y: boxY + 7,
          size: 12,
          font: bold,
          color: ink,
        });
      });
      return boxY - 20;
    };

    const columns = payload.columns.length ? payload.columns : ["Details"];
    const rows = payload.rows.length
      ? payload.rows
      : [{ [columns[0]!]: translate("No records match the selected report.", payload.locale) }];
    const weights = columns.map((column) => {
      const sample = rows
        .slice(0, 20)
        .reduce((size, row) => Math.max(size, String(row[column] ?? "").length), column.length);
      return Math.min(2.4, Math.max(0.65, sample / 15));
    });
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const tableWidth = pageSize[0] - margin * 2;
    const widths = weights.map((weight) => (tableWidth * weight) / weightTotal);
    const rowHeight = 20;
    const headerHeight = 22;
    const fontSize = columns.length > 9 ? 6.2 : columns.length > 7 ? 6.8 : 7.4;
    let page = pdf.addPage(pageSize);
    let pageNumber = 1;
    drawHeader(page, pageNumber);
    const tableTop = drawContext(page);
    let currentY = tableTop;
    let rowIndex = 0;
    const drawTableHeader = () => {
      let x = margin;
      page.drawRectangle({
        x: margin,
        y: currentY - headerHeight,
        width: tableWidth,
        height: headerHeight,
        color: rgb(0.91, 0.94, 0.97),
        borderColor: border,
        borderWidth: 0.7,
      });
      columns.forEach((column, index) => {
        page.drawText(truncatePdfText(column, bold, fontSize, widths[index]! - 10), {
          x: x + 5,
          y: currentY - 15,
          size: fontSize,
          font: bold,
          color: muted,
        });
        x += widths[index]!;
      });
      currentY -= headerHeight;
    };
    drawTableHeader();
    while (rowIndex < rows.length) {
      if (currentY - rowHeight < 34) {
        pageNumber += 1;
        page = pdf.addPage(pageSize);
        drawHeader(page, pageNumber);
        currentY = pageSize[1] - margin - 104;
        drawTableHeader();
      }
      const row = rows[rowIndex]!;
      let x = margin;
      if (rowIndex % 2 === 1)
        page.drawRectangle({
          x: margin,
          y: currentY - rowHeight,
          width: tableWidth,
          height: rowHeight,
          color: rgb(0.985, 0.99, 0.995),
        });
      columns.forEach((column, index) => {
        const value = row[column] ?? "—";
        page.drawText(truncatePdfText(value, regular, fontSize, widths[index]! - 10), {
          x: x + 5,
          y: currentY - 14,
          size: fontSize,
          font: regular,
          color: ink,
        });
        page.drawLine({
          start: { x, y: currentY },
          end: { x: x + widths[index]!, y: currentY },
          thickness: 0.45,
          color: border,
        });
        x += widths[index]!;
      });
      page.drawLine({
        start: { x: margin, y: currentY - rowHeight },
        end: { x: margin + tableWidth, y: currentY - rowHeight },
        thickness: 0.45,
        color: border,
      });
      currentY -= rowHeight;
      rowIndex += 1;
    }
    page.drawText(
      `${workspaceName} · ${payload.rows.length} ${translate("records", payload.locale)}`,
      { x: margin, y: 18, size: 8, font: regular, color: muted },
    );
    const bytes = await pdf.save();
    const downloadableBytes = Uint8Array.from(bytes);
    downloadBlob(
      new Blob([downloadableBytes.buffer as ArrayBuffer], { type: "application/pdf" }),
      `${payload.title}.pdf`,
    );
    return { success: true };
  } catch {
    return {
      success: false,
      error: translate("The PDF export could not be prepared.", payload.locale),
    };
  }
}

export async function exportReport(
  format: ReportExportFormat,
  payload: ReportExportPayload,
): Promise<ReportExportResult> {
  if (format === "csv") return exportCsv(payload);
  if (format === "xlsx") return exportXlsx(payload);
  return exportPdf(payload);
}
