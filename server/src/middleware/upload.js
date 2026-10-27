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
      const okExt = [".pdf", ".txt", ".md", ".png", ".jpg", ".jpeg", ".svg"].some((e) =>
        name.endsWith(e)
      );
      if (allowed.has(file.mimetype) || okExt) return cb(null, true);
      cb(new ApiError(400, "Invalid file type."));
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
