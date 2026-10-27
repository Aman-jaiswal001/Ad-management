import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ApiError } from "./utils/ApiError.js";
import authRoutes from "./routes/auth.js";
import workspaceRoutes from "./routes/workspaces.js";
import knowledgeRoutes from "./routes/knowledge.js";
import draftRoutes from "./routes/drafts.js";
import reviewRoutes, { findingRouter } from "./routes/reviews.js";
import { analyticsRouter, auditRouter } from "./routes/analytics.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 400,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get("/", (req, res) => {
  res.send("🚀 server is running...");
  }
)

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "inkloom-ai",
      providers: {
        groq: Boolean(env.groqApiKey),
        gemini: Boolean(env.geminiApiKey),
        qdrant: env.qdrantUrl,
      },
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/workspaces", workspaceRoutes);
  app.use("/api", knowledgeRoutes);
  app.use("/api/drafts", draftRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/findings", findingRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/audit-logs", auditRouter);

  app.use((req, res, next) => next(new ApiError(404, "Route not found.")));
  app.use(errorHandler);
  return app;
}

// Vercel's Node runtime loads this file as a function entry point and expects
// the default export to be the request handler/server.
const app = createApp();
export default app;
