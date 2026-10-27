import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || (err.name === "ValidationError" ? 400 : 500);
  const message =
    err instanceof ApiError || status < 500
      ? err.message
      : "An unexpected server error occurred.";
  res.status(status).json({
    error: message,
    details: err.details,
    ...(env.nodeEnv !== "production" && status >= 500 ? { stack: err.stack } : {}),
  });
}
