import { z } from "zod";
import {
  ALL_ROLES,
  CONTENT_TYPES,
  FINDING_CATEGORIES,
  FINDING_STATUSES,
  ISSUE_KINDS,
  SEVERITIES,
} from "../config/constants.js";

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  workspaceName: z.string().min(2).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const workspaceCreateSchema = z.object({
  name: z.string().min(2).max(80),
});

export const workspaceUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  brandVoice: z
    .object({
      preferredTone: z.string().optional(),
      writingPrinciples: z.array(z.string()).optional(),
      wordsToAvoid: z.array(z.string()).optional(),
      examples: z.array(z.string()).optional(),
    })
    .optional(),
  settings: z
    .object({
      chunkSize: z.number().int().min(200).max(4000).optional(),
      chunkOverlap: z.number().int().min(0).max(1000).optional(),
      retrievalCount: z.number().int().min(1).max(20).optional(),
      requiredDisclaimers: z.array(z.string()).optional(),
    })
    .optional(),
});

export const memberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ALL_ROLES),
});

export const roleSchema = z.object({
  role: z.enum(ALL_ROLES),
});

export const terminologySchema = z.object({
  officialTerm: z.string().min(1),
  prohibitedVariants: z.array(z.string()).default([]),
  explanation: z.string().optional().default(""),
  suggestedReplacement: z.string().optional().default(""),
});

export const claimSchema = z.object({
  claimText: z.string().min(1),
  supportingEvidence: z.string().optional().default(""),
  source: z.string().optional(),
  sourceOwner: z.string().optional().default(""),
  approvalStatus: z.enum(["pending", "approved", "superseded", "rejected"]).optional(),
  expiresAt: z.string().datetime().optional().or(z.string().optional()),
  reviewBy: z.string().optional(),
});

export const ruleSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  category: z.string().optional(),
  severity: z.enum(SEVERITIES).optional(),
  ruleText: z.string().min(1),
  exactPhrases: z.array(z.string()).optional().default([]),
  source: z.string().optional(),
  sourceVersion: z.number().optional(),
  approvalStatus: z.enum(["pending", "approved", "superseded", "rejected"]).optional(),
});

export const draftCreateSchema = z.object({
  title: z.string().min(1),
  contentType: z.enum(CONTENT_TYPES),
  content: z.string().optional().default(""),
});

export const draftUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  note: z.string().optional(),
});

export const findingPatchSchema = z.object({
  status: z.enum(FINDING_STATUSES),
  reason: z.string().optional().default(""),
  editedSuggestion: z.string().optional().default(""),
});

export const commentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const reasonSchema = z.object({
  reason: z.string().min(1).max(5000),
});

export const assignSchema = z.object({
  reviewerId: z.string().min(1),
});

export const llmFindingSchema = z.object({
  findings: z.array(
    z.object({
      category: z.enum(FINDING_CATEGORIES),
      severity: z.enum(SEVERITIES),
      title: z.string(),
      matchedText: z.string().optional().default(""),
      explanation: z.string(),
      suggestedCorrection: z.string().optional().default(""),
      sourceIds: z.array(z.string()).optional().default([]),
      confidence: z.number().min(0).max(1).optional().default(0.5),
      requiresHumanReview: z.boolean().optional().default(false),
      issueKind: z.enum(ISSUE_KINDS).optional().default("potential_issue"),
      section: z.string().optional().default(""),
      pageNumber: z.number().optional(),
    })
  ),
});

export function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const err = new Error("Validation failed.");
    err.status = 400;
    err.details = result.error.flatten();
    throw err;
  }
  return result.data;
}
