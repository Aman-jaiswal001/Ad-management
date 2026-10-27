import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../../config/env.js";

let client;

export function getQdrant() {
  if (!client) {
    client = new QdrantClient({
      url: env.qdrantUrl,
      apiKey: env.qdrantApiKey || undefined,
    });
  }
  return client;
}

export async function ensureCollection() {
  const qdrant = getQdrant();
  const name = env.qdrantCollection;
  try {
    await qdrant.getCollection(name);
  } catch {
    await qdrant.createCollection(name, {
      vectors: { size: env.embeddingDimensions, distance: "Cosine" },
    });
  }
}

function pointId(workspaceId, sourceId, index) {
  const raw = `${workspaceId}:${sourceId}:${index}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  const hex = Buffer.from(raw).toString("hex").slice(0, 32).padEnd(32, "0");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export async function upsertChunks({ workspaceId, source, chunks, vectors }) {
  await ensureCollection();
  const qdrant = getQdrant();
  const points = chunks.map((chunk, i) => ({
    id: pointId(workspaceId, source._id, chunk.index),
    vector: vectors[i],
    payload: {
      workspaceId: String(workspaceId),
      sourceId: String(source._id),
      sourceName: source.name,
      sourceVersion: source.version,
      isActiveVersion: Boolean(source.isActiveVersion),
      approvalStatus: source.approvalStatus,
      chunkIndex: chunk.index,
      text: chunk.text,
      pageNumber: chunk.pageNumber || null,
      section: `chunk-${chunk.index}`,
    },
  }));
  await qdrant.upsert(env.qdrantCollection, { wait: true, points });
  return points.length;
}

export async function deleteSourcePoints(workspaceId, sourceId) {
  await ensureCollection();
  const qdrant = getQdrant();
  await qdrant.delete(env.qdrantCollection, {
    wait: true,
    filter: {
      must: [
        { key: "workspaceId", match: { value: String(workspaceId) } },
        { key: "sourceId", match: { value: String(sourceId) } },
      ],
    },
  });
}

export async function searchWorkspace({ workspaceId, vector, limit }) {
  await ensureCollection();
  const qdrant = getQdrant();
  const results = await qdrant.search(env.qdrantCollection, {
    vector,
    limit: limit || env.retrievalCount,
    with_payload: true,
    filter: {
      must: [
        { key: "workspaceId", match: { value: String(workspaceId) } },
        { key: "approvalStatus", match: { value: "approved" } },
        { key: "isActiveVersion", match: { value: true } },
      ],
    },
  });
  return results.map((hit) => ({
    id: String(hit.id),
    score: hit.score,
    ...hit.payload,
  }));
}

export function filterAuthoritative(hits, { workspaceId } = {}) {
  return (hits || []).filter((hit) => {
    if (workspaceId && String(hit.workspaceId) !== String(workspaceId)) return false;
    if (hit.approvalStatus !== "approved") return false;
    if (hit.isActiveVersion === false) return false;
    return true;
  });
}
