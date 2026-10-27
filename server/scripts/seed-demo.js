import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import {
  ApprovedClaim,
  BrandRule,
  BrandSource,
  Draft,
  DraftRevision,
  TerminologyEntry,
  User,
  Workspace,
  WorkspaceMember,
} from "../src/models/index.js";
import { APPROVAL_STATUS, DRAFT_STATUS, ROLES, SOURCE_STATUS } from "../src/config/constants.js";
import { groqConfigured, geminiConfigured } from "../src/services/ai/providers.js";
import { embeddingsConfigured } from "../src/services/rag/embeddings.js";
import { indexBrandSource } from "../src/services/rag/indexSource.js";
import { runContentReview } from "../src/services/review/pipeline.js";

const PASSWORDS = {
  admin: "NovaPay!Admin1",
  creator: "NovaPay!Creator1",
  manager: "NovaPay!Manager1",
  reviewer: "NovaPay!Reviewer1",
};

const GUIDELINE_TEXT = `NovaPay Digital — Approved Brand Guidelines (SYNTHETIC DEMO)

Official product name: NovaPay
Never write Nova Pay or Nova-Pay.

Brand tone: Professional, clear, and trustworthy.

Approved claim:
"Secure digital payments with real-time transaction monitoring."

Rules:
1. Absolute claims such as "100% secure" require specific approval and supporting evidence.
2. Product performance claims require approved evidence.
3. Do not promise risk-free or unhackable payments.

This document is synthetic demonstration content for Inkloom AI. It is not a real financial product disclosure.
`;

const DRAFTS = [
  {
    key: "correct",
    title: "Compliant social post",
    contentType: "social_media_post",
    content:
      "Meet NovaPay: secure digital payments with real-time transaction monitoring. Built for teams that need clarity and trust.",
  },
  {
    key: "terms",
    title: "Incorrect terminology ad",
    contentType: "advertisement",
    content:
      "Switch to Nova Pay today. Nova-Pay is the fastest checkout your customers will ever see.",
  },
  {
    key: "claims",
    title: "Unsupported promotional email",
    contentType: "email_campaign",
    content:
      "NovaPay is 100% secure and guaranteed to never fail. We are the unhackable payments leader with zero risk.",
  },
  {
    key: "human",
    title: "High-risk performance blog",
    contentType: "blog_post",
    content:
      "NovaPay processes money instantly for every merchant and is always faster than every competitor. Our internal tests prove unlimited throughput.",
  },
];

async function upsertUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return User.findOneAndUpdate(
    { email },
    { name, email, passwordHash },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function main() {
  await connectDb();
  console.log("Connected to", env.mongoUri);

  const admin = await upsertUser({ name: "Nova Admin", email: "admin@novapay.demo", password: PASSWORDS.admin });
  const creator = await upsertUser({
    name: "Nova Creator",
    email: "creator@novapay.demo",
    password: PASSWORDS.creator,
  });
  const manager = await upsertUser({
    name: "Nova Manager",
    email: "manager@novapay.demo",
    password: PASSWORDS.manager,
  });
  const reviewer = await upsertUser({
    name: "Nova Reviewer",
    email: "reviewer@novapay.demo",
    password: PASSWORDS.reviewer,
  });

  const workspace = await Workspace.findOneAndUpdate(
    { slug: "novapay-digital-demo" },
    {
      name: "NovaPay Digital (synthetic demo)",
      slug: "novapay-digital-demo",
      createdBy: admin._id,
      isSyntheticDemo: true,
      brandVoice: {
        preferredTone: "Professional, clear, and trustworthy",
        writingPrinciples: [
          "Use the official product name NovaPay",
          "Support claims with approved evidence",
          "Avoid absolute security language without approval",
        ],
        wordsToAvoid: ["unhackable", "risk-free", "guaranteed"],
        examples: [
          "NovaPay provides secure digital payments with real-time transaction monitoring.",
        ],
      },
      settings: {
        chunkSize: 800,
        chunkOverlap: 120,
        retrievalCount: 8,
        requiredDisclaimers: [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  for (const [user, role] of [
    [admin, ROLES.ADMIN],
    [creator, ROLES.CREATOR],
    [manager, ROLES.MANAGER],
    [reviewer, ROLES.REVIEWER],
  ]) {
    await WorkspaceMember.findOneAndUpdate(
      { workspace: workspace._id, user: user._id },
      { role },
      { upsert: true, new: true }
    );
    user.lastWorkspace = workspace._id;
    await user.save();
  }

  const source = await BrandSource.findOneAndUpdate(
    { workspace: workspace._id, name: "NovaPay Brand Guidelines v1" },
    {
      originalFilename: "novapay-guidelines.txt",
      mimeType: "text/plain",
      extractedText: GUIDELINE_TEXT,
      version: 1,
      isActiveVersion: true,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      extractionStatus: SOURCE_STATUS.EXTRACTED,
      uploadedBy: admin._id,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await TerminologyEntry.findOneAndUpdate(
    { workspace: workspace._id, officialTerm: "NovaPay" },
    {
      prohibitedVariants: ["Nova Pay", "Nova-Pay"],
      explanation: "The official product name is a single word: NovaPay.",
      suggestedReplacement: "NovaPay",
      createdBy: admin._id,
    },
    { upsert: true, new: true }
  );

  await ApprovedClaim.findOneAndUpdate(
    { workspace: workspace._id, claimText: "Secure digital payments with real-time transaction monitoring." },
    {
      supportingEvidence: "Approved in NovaPay Brand Guidelines v1 (synthetic demo).",
      source: source._id,
      sourceOwner: "Brand team (demo)",
      approvalStatus: APPROVAL_STATUS.APPROVED,
      createdBy: admin._id,
    },
    { upsert: true, new: true }
  );

  await BrandRule.findOneAndUpdate(
    { workspace: workspace._id, title: "Absolute security claims" },
    {
      description: "Absolute claims such as 100% secure require approval and evidence.",
      category: "absolute_exaggerated_claims",
      severity: "Critical",
      ruleText: 'Do not use "100% secure" or similar absolute claims without specific approval.',
      exactPhrases: ["100% secure"],
      source: source._id,
      sourceVersion: 1,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      createdBy: admin._id,
    },
    { upsert: true, new: true }
  );

  await BrandRule.findOneAndUpdate(
    { workspace: workspace._id, title: "Performance claims need evidence" },
    {
      description: "Product performance claims require approved evidence.",
      category: "unsupported_claims",
      severity: "High",
      ruleText: "Any performance comparison or speed claim must cite an approved source.",
      exactPhrases: [],
      source: source._id,
      sourceVersion: 1,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      createdBy: admin._id,
    },
    { upsert: true, new: true }
  );

  const createdDrafts = [];
  for (const sample of DRAFTS) {
    const draft = await Draft.findOneAndUpdate(
      { workspace: workspace._id, title: sample.title },
      {
        creator: creator._id,
        contentType: sample.contentType,
        originalContent: sample.content,
        currentContent: sample.content,
        status: DRAFT_STATUS.DRAFT,
        currentRevision: 1,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await DraftRevision.findOneAndUpdate(
      { draft: draft._id, revisionNumber: 1 },
      {
        workspace: workspace._id,
        content: sample.content,
        createdBy: creator._id,
        note: "Original (synthetic demo)",
      },
      { upsert: true, new: true }
    );
    createdDrafts.push(draft);
  }

  if (embeddingsConfigured()) {
    try {
      await indexBrandSource(source, workspace.settings);
      console.log("Indexed demo guidelines. Chunks:", source.indexedChunkCount);
    } catch (err) {
      console.warn("Qdrant/embedding indexing skipped:", err.message);
    }
  } else {
    console.warn("Skipping Qdrant indexing: GEMINI_API_KEY is not set.");
  }

  if (groqConfigured() || geminiConfigured()) {
    for (const draft of createdDrafts) {
      try {
        const result = await runContentReview({
          draftId: draft._id,
          workspaceId: workspace._id,
          userId: creator._id,
        });
        console.log(`Reviewed "${draft.title}": ${result.findings.length} findings`);
      } catch (err) {
        console.warn(`Review skipped for "${draft.title}":`, err.message);
      }
    }
  } else {
    console.warn("Skipping live AI review: configure GROQ_API_KEY or GEMINI_API_KEY.");
  }

  console.log("\nNovaPay Digital synthetic demo is ready.");
  console.log("Logins:");
  console.log("  ADMIN    admin@novapay.demo     ", PASSWORDS.admin);
  console.log("  CREATOR  creator@novapay.demo   ", PASSWORDS.creator);
  console.log("  MANAGER  manager@novapay.demo   ", PASSWORDS.manager);
  console.log("  REVIEWER reviewer@novapay.demo  ", PASSWORDS.reviewer);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
