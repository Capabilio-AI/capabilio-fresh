import { PDFParse } from "pdf-parse";
import type { ExtractionErrorCode } from "./types";

/** The real JNTUK R23 CSE syllabus is 2.2 MB / 158 pages; 15 MB leaves room for image-heavy syllabi without inviting abuse. */
export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 400;
/** Below this many characters per page there is no usable text layer (a scan). */
const MIN_CHARS_PER_PAGE = 80;

export type PdfCheck = { ok: true } | { ok: false; status: number; message: string };

/** Type is judged from the file's first bytes; the browser-supplied Content-Type is never trusted. */
export function checkPdfBytes(bytes: Uint8Array): PdfCheck {
  if (bytes.length === 0) return { ok: false, status: 400, message: "Choose a syllabus PDF to upload." };
  if (bytes.length > MAX_PDF_BYTES) return { ok: false, status: 413, message: `The PDF must be under ${MAX_PDF_BYTES / 1024 / 1024} MB.` };
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return { ok: false, status: 415, message: "Upload a PDF file." };
  return { ok: true };
}

const HEADER_LINES = [/^JAWAHARLAL NEHRU TECHNOLOGICAL UNIVERSITY/i, /^KAKINADA\s*[–-]\s*533/i, /^R\d+ B\.Tech .*COURSE STRUCTURE/i];

/** Pure. Drops the running page header and the lone page-number line so they never land inside a chunk. */
export function stripPageChrome(pageText: string): string {
  const lines = pageText.split(/\r?\n/);
  let numberDropped = false;
  return lines
    .filter((l, i) => {
      const t = l.trim();
      if (HEADER_LINES.some((re) => re.test(t))) return false;
      if (!numberDropped && i < 6 && /^\d{1,3}$/.test(t)) return (numberDropped = true), false;
      return true;
    })
    .join("\n");
}

export type PdfText = { ok: true; pages: string[] } | { ok: false; code: ExtractionErrorCode };

export async function extractPdfPages(bytes: Uint8Array): Promise<PdfText> {
  const parser = new PDFParse({ data: bytes.slice() }) // pdfjs detaches the buffer it is given — hand it a copy;
  try {
    const result = await parser.getText();
    if (result.total > MAX_PDF_PAGES) return { ok: false, code: "unreadable" };
    const pages = result.pages.map((p) => stripPageChrome(p.text));
    const chars = pages.reduce((n, p) => n + p.trim().length, 0);
    if (pages.length === 0 || chars / pages.length < MIN_CHARS_PER_PAGE) return { ok: false, code: "no_text_layer" };
    return { ok: true, pages };
  } catch {
    return { ok: false, code: "unreadable" };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
