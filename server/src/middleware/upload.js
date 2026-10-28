import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const ALLOWED = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/octet-stream",
]);

export function createUploader({ fileTypes } = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.maxFileSize },
    fileFilter(req, file, cb) {
      const allowed = fileTypes || ALLOWED;
      const name = (file.originalname || "").toLowerCase();
      const extensions = {
        ".pdf": ["application/pdf", "application/octet-stream"],
        ".txt": ["text/plain", "application/octet-stream"],
        ".md": ["text/markdown", "text/plain", "application/octet-stream"],
        ".png": ["image/png", "application/octet-stream"],
        ".jpg": ["image/jpeg", "application/octet-stream"],
        ".jpeg": ["image/jpeg", "application/octet-stream"],
        ".svg": ["image/svg+xml", "text/xml", "application/octet-stream"],
      };
      const ext = Object.keys(extensions).find((e) => name.endsWith(e));
      const typeAllowed = fileTypes
        ? (ext === ".pdf" && allowed.has("application/pdf") && ["application/pdf", "application/octet-stream"].includes(file.mimetype)) ||
          (ext === ".txt" && allowed.has("text/plain") && ["text/plain", "application/octet-stream"].includes(file.mimetype)) ||
          (ext === ".md" && allowed.has("text/markdown") && ["text/markdown", "text/plain", "application/octet-stream"].includes(file.mimetype))
        : allowed.has(file.mimetype) && extensions[ext]?.includes(file.mimetype);
      if (ext && typeAllowed) {
        req.detectedExtension = ext;
        return cb(null, true);
      }
      cb(new ApiError(400, fileTypes ? "Upload a PDF or UTF-8 text file (.pdf, .txt, .md)." : "Unsupported file type or extension does not match its content type."));
    },
  });
}

export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(400, `File exceeds the ${env.maxFileSize} byte limit.`));
    }
    return next(new ApiError(400, err.message));
  }
  next(err);
}

export const sourceUpload = createUploader({
  fileTypes: new Set(["application/pdf", "text/plain", "text/markdown", "application/octet-stream"]),
});
export const draftUpload = sourceUpload;
export const assetUpload = createUploader();

export function validateFileSignature(req, res, next) {
  const file = req.file;
  if (!file) return next();
  if (!file.buffer?.length) return next(new ApiError(400, "The uploaded file is empty."));
  const ext = req.detectedExtension;
  const b = file.buffer;
  const signatures = {
    ".pdf": b.subarray(0, 5).toString("ascii") === "%PDF-",
    ".png": b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    ".jpg": b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    ".jpeg": b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    ".txt": !b.includes(0) && isUtf8(b),
    ".md": !b.includes(0) && isUtf8(b),
    ".svg": /<svg[\s>]/i.test(b.toString("utf8", 0, Math.min(b.length, 4096))),
  };
  if (!signatures[ext]) return next(new ApiError(400, "File signature does not match the selected file type."));
  next();
}

function isUtf8(buffer) {
  return Buffer.from(buffer.toString("utf8"), "utf8").equals(buffer);
}
