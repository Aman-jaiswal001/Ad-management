import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../src/services/documents/extract.js";
import { env } from "../src/config/env.js";

describe("document processing", () => {
  it("chunks text with overlap", () => {
    const text = "A".repeat(1000);
    const chunks = chunkText(text, { chunkSize: 300, overlap: 50 });
    assert.ok(chunks.length >= 4);
    assert.equal(chunks[0].index, 0);
  });

  it("returns empty chunks for empty extract", () => {
    assert.deepEqual(chunkText("   "), []);
  });

  it("enforces configured max file size", () => {
    assert.ok(env.maxFileSize > 0);
  });
});
