import { createRequire } from "module";
import { normalizeText } from "../../utils/text.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export async function extractFromBuffer(buffer, mimeType, originalName) {
  const lower = (originalName || "").toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    const text = normalizeText(parsed.text || "");
    if (!text) {
      const err = new Error("PDF contained no extractable text. Image-only PDFs are not reviewed visually.");
      err.status = 422;
      throw err;
    }
    return { text, pages: parsed.numpages || 1 };
  }
  if (mimeType?.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md")) {
    const text = normalizeText(buffer.toString("utf8"));
    if (!text) {
      const err = new Error("The uploaded text file is empty.");
      err.status = 422;
      throw err;
    }
    return { text, pages: 1 };
  }
  const err = new Error("Unsupported file type. Upload a PDF or UTF-8 text file.");
  err.status = 400;
  throw err;
}

export function chunkText(text, { chunkSize = 800, overlap = 120 } = {}) {
  const clean = normalizeText(text);
  if (!clean) return [];
  const chunks = [];
  let start = 0;
  let index = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + chunkSize);
    const slice = clean.slice(start, end);
    chunks.push({
      index,
      text: slice,
      start,
      end,
      pageNumber: estimatePage(clean, start),
    });
    index += 1;
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

function estimatePage(text, offset) {
  const prefix = text.slice(0, offset);
  const formFeeds = (prefix.match(/\f/g) || []).length;
  if (formFeeds) return formFeeds + 1;
  return Math.floor(offset / 3000) + 1;
}
