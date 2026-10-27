import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { env } from "../../config/env.js";

export function embeddingsConfigured() {
  return Boolean(env.geminiApiKey);
}

export function createEmbeddings() {
  if (!env.geminiApiKey) {
    const err = new Error(
      "GEMINI_API_KEY is required for Google Generative AI embeddings used by RAG indexing."
    );
    err.status = 503;
    err.code = "EMBEDDING_CONFIG";
    throw err;
  }
  return new GoogleGenerativeAIEmbeddings({
    apiKey: env.geminiApiKey,
    model: env.embeddingModel,
  });
}

export async function embedTexts(texts) {
  const model = createEmbeddings();
  return model.embedDocuments(texts);
}

export async function embedQuery(text) {
  const model = createEmbeddings();
  return model.embedQuery(text);
}
