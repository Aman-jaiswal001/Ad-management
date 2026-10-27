import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateStructuredFindings } from "../src/services/ai/providers.js";

describe("provider fallback", () => {
  it("uses primary then fallback invoke when injected", async () => {
    let calls = 0;
    const result = await generateStructuredFindings({
      system: "s",
      user: "u",
      invokeProvider: async () => {
        calls += 1;
        return {
          findings: [],
          providerUsed: "groq",
          fallbackUsed: false,
          tokenUsage: { prompt: 1, completion: 1 },
        };
      },
    });
    console.log("providers.test.js : ",result)
    assert.equal(calls, 1);
    assert.equal(result.providerUsed, "groq");
  });

  it("surfaces injected provider failure", async () => {
    await assert.rejects(
      () =>
        generateStructuredFindings({
          system: "s",
          user: "u",
          invokeProvider: async () => {
            throw new Error("timeout");
          },
        }),
      /timeout/
    );
  });
});
