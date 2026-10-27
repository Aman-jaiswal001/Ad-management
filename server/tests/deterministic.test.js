import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dedupeFindings,
  generateRetrievalQueries,
  mergeFindings,
  runDeterministicChecks,
} from "../src/services/review/deterministic.js";
import { attachValidCitations, validateCitationIds } from "../src/services/review/citations.js";
import { filterAuthoritative } from "../src/services/rag/qdrant.js";
import { extractJson } from "../src/services/ai/providers.js";
import { llmFindingSchema } from "../src/validators/schemas.js";

describe("deterministic checks", () => {
  it("flags discouraged terminology", () => {
    const findings = runDeterministicChecks({
      content: "Try Nova Pay and Nova-Pay today.",
      terminology: [
        {
          officialTerm: "NovaPay",
          prohibitedVariants: ["Nova Pay", "Nova-Pay"],
          explanation: "One word",
          suggestedReplacement: "NovaPay",
        },
      ],
    });
    assert.equal(findings.filter((f) => f.category === "inconsistent_terminology").length, 2);
    assert.equal(findings[0].issueKind, "confirmed_rule_violation");
  });

  it("flags absolute claims and exact phrases", () => {
    const findings = runDeterministicChecks({
      content: "NovaPay is 100% secure and guaranteed.",
      rules: [
        {
          title: "Absolute",
          severity: "Critical",
          category: "absolute_exaggerated_claims",
          ruleText: "No 100% secure",
          exactPhrases: ["100% secure"],
        },
      ],
    });
    assert.ok(findings.some((f) => f.severity === "Critical"));
  });

  it("flags missing disclaimers and expired claims", () => {
    const findings = runDeterministicChecks({
      content: "Secure digital payments with real-time transaction monitoring.",
      requiredDisclaimers: ["Not financial advice"],
      claims: [
        {
          claimText: "Secure digital payments with real-time transaction monitoring.",
          expiresAt: new Date("2020-01-01"),
        },
      ],
    });
    assert.ok(findings.some((f) => f.category === "missing_disclaimers"));
    assert.ok(findings.some((f) => f.category === "outdated_facts"));
  });

  it("dedupes and merges findings", () => {
    const a = [{ category: "x", matchedText: "a", title: "t" }];
    const merged = mergeFindings(a, a);
    assert.equal(merged.length, 1);
    assert.equal(dedupeFindings(a.concat(a)).length, 1);
  });

  it("builds retrieval queries", () => {
    const q = generateRetrievalQueries({
      content: "NovaPay is the best and guaranteed product.",
      terminology: [{ officialTerm: "NovaPay", prohibitedVariants: ["Nova Pay"] }],
      rules: [{ title: "Abs", ruleText: "no 100%" }],
      claims: [{ claimText: "secure digital payments" }],
    });
    assert.ok(q.length >= 2);
  });
});

describe("citations", () => {
  const retrieved = [
    {
      sourceId: "abc",
      sourceName: "Guidelines",
      sourceVersion: 1,
      section: "chunk-0",
      text: "Official name is NovaPay",
    },
  ];

  it("keeps only retrieved source ids", () => {
    const valid = validateCitationIds(["abc", "invented"], retrieved);
    assert.deepEqual(valid, ["abc"]);
  });

  it("labels missing evidence as needs verification", () => {
    const attached = attachValidCitations(
      {
        category: "unsupported_claims",
        explanation: "Claim not in knowledge base.",
        sourceIds: ["invented"],
        issueKind: "confirmed_rule_violation",
      },
      retrieved
    );
    assert.equal(attached.issueKind, "needs_verification");
    assert.equal(attached.sourceReferences.length, 0);
  });

  it("attaches real references", () => {
    const attached = attachValidCitations(
      { explanation: "ok", sourceIds: ["abc"], issueKind: "confirmed_rule_violation" },
      retrieved
    );
    assert.equal(attached.sourceReferences[0].sourceId, "abc");
  });
});

describe("inactive source exclusion", () => {
  it("drops other workspaces, unapproved, and inactive versions", () => {
    const hits = [
      { workspaceId: "w1", approvalStatus: "approved", isActiveVersion: true, sourceId: "1" },
      { workspaceId: "w2", approvalStatus: "approved", isActiveVersion: true, sourceId: "2" },
      { workspaceId: "w1", approvalStatus: "pending", isActiveVersion: true, sourceId: "3" },
      { workspaceId: "w1", approvalStatus: "approved", isActiveVersion: false, sourceId: "4" },
    ];
    const filtered = filterAuthoritative(hits, { workspaceId: "w1" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].sourceId, "1");
  });
});

describe("LLM JSON validation", () => {
  it("parses fenced JSON", () => {
    const json = extractJson('```json\n{"findings":[]}\n```');
    assert.deepEqual(json, { findings: [] });
  });

  it("rejects invalid structured output", () => {
    const parsed = llmFindingSchema.safeParse({ findings: [{ title: "x" }] });
    assert.equal(parsed.success, false);
  });

  it("accepts a valid finding payload", () => {
    const parsed = llmFindingSchema.safeParse({
      findings: [
        {
          category: "unsupported_claims",
          severity: "High",
          title: "Needs evidence",
          explanation: "No approved source",
          issueKind: "needs_verification",
          confidence: 0.4,
        },
      ],
    });
    assert.equal(parsed.success, true);
  });
});
