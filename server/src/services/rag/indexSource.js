import { BrandSource } from "../../models/BrandSource.js";
import { SOURCE_STATUS } from "../../config/constants.js";
import { chunkText } from "../documents/extract.js";
import { embedTexts } from "./embeddings.js";
import { deleteSourcePoints, upsertChunks } from "./qdrant.js";
import { env } from "../../config/env.js";

export async function indexBrandSource(source, { chunkSize, chunkOverlap } = {}) {
  const size = chunkSize || env.chunkSize;
  const overlap = chunkOverlap || env.chunkOverlap;
  source.extractionStatus = SOURCE_STATUS.INDEXING;
  source.indexingError = "";
  await source.save();
  try {
    await deleteSourcePoints(source.workspace, source._id);
    const chunks = chunkText(source.extractedText, { chunkSize: size, overlap });
    if (!chunks.length) {
      throw new Error("No text chunks available to index.");
    }
    const vectors = await embedTexts(chunks.map((c) => c.text));
    if (vectors[0] && vectors[0].length !== env.embeddingDimensions) {
      throw new Error(
        `Embedding dimension ${vectors[0].length} does not match QDRANT/EMBEDDING_DIMENSIONS=${env.embeddingDimensions}.`
      );
    }
    const count = await upsertChunks({
      workspaceId: source.workspace,
      source,
      chunks,
      vectors,
    });
    source.indexedChunkCount = count;
    source.extractionStatus = SOURCE_STATUS.INDEXED;
    await source.save();
    return source;
  } catch (err) {
    source.extractionStatus = SOURCE_STATUS.ERROR;
    source.indexingError = err.message;
    source.indexedChunkCount = 0;
    await source.save();
    throw err;
  }
}

export async function reindexSourceById(sourceId, workspaceId, settings) {
  const source = await BrandSource.findOne({ _id: sourceId, workspace: workspaceId });
  if (!source) {
    const err = new Error("Source not found.");
    err.status = 404;
    throw err;
  }
  return indexBrandSource(source, settings);
}
