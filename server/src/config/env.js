import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/inkloom",
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-004",
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS || 768),
  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  qdrantApiKey: process.env.QDRANT_API_KEY || "",
  qdrantCollection: process.env.QDRANT_COLLECTION || "inkloom_chunks",
  maxFileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  chunkSize: Number(process.env.CHUNK_SIZE || 800),
  chunkOverlap: Number(process.env.CHUNK_OVERLAP || 120),
  retrievalCount: Number(process.env.RETRIEVAL_COUNT || 8),
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 45000),
  llmMaxRetries: Number(process.env.LLM_MAX_RETRIES || 2),
  retentionDays: Number(process.env.RETENTION_DAYS || 365),
  nodeEnv: process.env.NODE_ENV || "development",
};
