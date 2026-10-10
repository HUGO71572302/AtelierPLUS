"use client";

/**
 * Generates a small, real PDF without a third-party dependency.
 * The receipt is first rendered by Canvas (so French accents and FCFA render
 * correctly), then the JPEG canvas is embedded in a single-page PDF.
 * Data never leaves the device.
 */

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 36;

type PdfTextDocument = {
  title: string;
  subtitle?: string;
  lines: string[];
  footer?: string;
};

function textLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function cleanLine(value: string) {
  return value
    .replace(/[━─]/g, "—")
    .replace(/✂/g, "")
    .replace(/✔/g, "✓")
    .trim();
}

function buildCanvas(document: PdfTextDocument): HTMLCanvasElement {
  const scale = 2;
  const width = 1240;
  const padding = 82;
  const contentWidth = width - padding * 2;
  const provisionalHeight = 1800;
  const measureCanvas = window.document.createElement("canvas");
  measureCanvas.width = width;
  measureCanvas.height = provisionalHeight;
  const measure = measureCanvas.getContext("2d");
  if (!measure) throw new Error("Le navigateur ne peut pas préparer ce reçu PDF.");

  let y = padding;
  measure.font = "800 40px Arial, sans-serif";
  y += 62;
  if (document.subtitle) {
    measure.font = "600 25px Arial, sans-serif";
    y += 46;
  }
  y += 30;
  measure.font = "600 25px Arial, sans-serif";
  for (const rawLine of document.lines) {
    const line = cleanLine(rawLine);
    if (!line) {
      y += 20;
      continue;
    }
    const wrapped = textLines(measure, line, contentWidth);
    y += wrapped.length * 38 + 10;
  }
  if (document.footer) y += 72;
  y += padding;

  const canvas = window.document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = Math.max(760, y * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le navigateur ne peut pas dessiner ce reçu PDF.");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, canvas.height / scale);

  // Brand strip and perforated separator.
  context.fillStyle = "#2f4438";
  context.fillRect(0, 0, width, 18);
  context.strokeStyle = "#d3e4bd";
  context.setLineDash([6, 7]);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(padding, 150);
  context.lineTo(width - padding, 150);
  context.stroke();
  context.setLineDash([]);

  let drawY = padding + 6;
  context.fillStyle = "#2b1c12";
  context.font = "800 40px Arial, sans-serif";
  context.fillText(document.title, padding, drawY + 45);
  drawY += 72;
  if (document.subtitle) {
    context.fillStyle = "#7c3a1e";
    context.font = "700 25px Arial, sans-serif";
    context.fillText(document.subtitle, padding, drawY + 26);
    drawY += 54;
  }
  drawY += 30;

  for (const rawLine of document.lines) {
    const line = cleanLine(rawLine);
    if (!line) {
      drawY += 20;
      continue;
    }
    const isEmphasis = /RESTE À PAYER|MONTANT REÇU|PRIX CONVENU|COMMANDE SOLDÉE|TOTAL/.test(line.toUpperCase());
    context.fillStyle = isEmphasis ? "#2f4438" : "#3a3a36";
    context.font = isEmphasis ? "800 27px Arial, sans-serif" : "600 25px Arial, sans-serif";
    const wrapped = textLines(context, line, contentWidth);
    for (const part of wrapped) {
      context.fillText(part, padding, drawY + 27);
      drawY += 38;
    }
    drawY += 10;
  }

  if (document.footer) {
    drawY += 18;
    context.strokeStyle = "#d3e4bd";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(padding, drawY);
    context.lineTo(width - padding, drawY);
    context.stroke();
    context.fillStyle = "#5d7448";
    context.font = "700 20px Arial, sans-serif";
    context.fillText(document.footer, padding, drawY + 40);
  }

  return canvas;
}

function jpegBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function ascii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }
  return combined;
}

function pdfFromJpeg(jpeg: Uint8Array, imageWidth: number, imageHeight: number): Uint8Array {
  const printableWidth = A4_WIDTH - MARGIN * 2;
  const printableHeight = A4_HEIGHT - MARGIN * 2;
  const imageRatio = imageWidth / imageHeight;
  let drawWidth = printableWidth;
  let drawHeight = drawWidth / imageRatio;
  if (drawHeight > printableHeight) {
    drawHeight = printableHeight;
    drawWidth = drawHeight * imageRatio;
  }
  const drawX = (A4_WIDTH - drawWidth) / 2;
  const drawY = A4_HEIGHT - MARGIN - drawHeight;
  const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im0 Do\nQ\n`;

  const objects: Uint8Array[] = [];
  objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects[3] = ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>");
  objects[4] = ascii(`<< /Length ${ascii(content).length} >>\nstream\n${content}endstream`);
  objects[5] = concat([
    ascii(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    ascii("\nendstream"),
  ]);

  const header = ascii("%PDF-1.4\n%âãÏÓ\n");
  const parts: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let byteOffset = header.length;
  for (let index = 1; index <= 5; index += 1) {
    offsets[index] = byteOffset;
    const objectBytes = concat([ascii(`${index} 0 obj\n`), objects[index], ascii("\nendobj\n")]);
    parts.push(objectBytes);
    byteOffset += objectBytes.length;
  }
  const xrefOffset = byteOffset;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let index = 1; index <= 5; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(ascii(trailer));
  return concat(parts);
}

export function downloadTextPdf(document: PdfTextDocument, fileName: string): void {
  const canvas = buildCanvas(document);
  const jpeg = jpegBytes(canvas.toDataURL("image/jpeg", 0.94));
  const pdf = pdfFromJpeg(jpeg, canvas.width, canvas.height);
  // Copy into a plain ArrayBuffer: Safari/TypeScript disagree on Uint8Array's generic buffer type.
  const safeBytes = new Uint8Array(pdf.length);
  safeBytes.set(pdf);
  const blob = new Blob([safeBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
