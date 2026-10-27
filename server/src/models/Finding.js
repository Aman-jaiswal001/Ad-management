import mongoose from "mongoose";
import {
  FINDING_CATEGORIES,
  FINDING_STATUSES,
  ISSUE_KINDS,
  SEVERITIES,
} from "../config/constants.js";

const sourceRefSchema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true },
    sourceName: { type: String, default: "" },
    sourceVersion: { type: Number, default: 1 },
    section: { type: String, default: "" },
    pageNumber: { type: Number },
    quote: { type: String, default: "" },
  },
  { _id: false }
);

const findingSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    draft: { type: mongoose.Schema.Types.ObjectId, ref: "Draft", required: true },
    reviewRun: { type: mongoose.Schema.Types.ObjectId, ref: "ReviewRun", required: true },
    publicId: { type: String, required: true },
    category: { type: String, enum: FINDING_CATEGORIES, required: true },
    severity: { type: String, enum: SEVERITIES, required: true },
    title: { type: String, required: true },
    matchedText: { type: String, default: "" },
    explanation: { type: String, default: "" },
    suggestedCorrection: { type: String, default: "" },
    editedSuggestion: { type: String, default: "" },
    sourceReferences: [sourceRefSchema],
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    status: { type: String, enum: FINDING_STATUSES, default: "Open" },
    requiresHumanReview: { type: Boolean, default: false },
    issueKind: { type: String, enum: ISSUE_KINDS, default: "potential_issue" },
    origin: { type: String, enum: ["deterministic", "ai", "merged"], default: "ai" },
    dismissReason: { type: String, default: "" },
    actedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

findingSchema.index({ workspace: 1, draft: 1 });
findingSchema.index({ reviewRun: 1 });
findingSchema.index({ workspace: 1, category: 1, severity: 1 });
findingSchema.index({ publicId: 1 }, { unique: true });

export const Finding = mongoose.model("Finding", findingSchema);
