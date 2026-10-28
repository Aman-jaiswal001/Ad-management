import mongoose from "mongoose";
import { CONTENT_TYPES, DRAFT_STATUS } from "../config/constants.js";

const draftSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    contentType: { type: String, enum: CONTENT_TYPES, required: true },
    originalContent: { type: String, default: "" },
    currentContent: { type: String, default: "" },
    sourceFilePath: { type: String, default: "" },
    sourceFilename: { type: String, default: "" },
    sourceCloudinaryPublicId: { type: String, default: "" },
    sourceCloudinaryResourceType: { type: String, default: "raw" },
    sourceCloudinaryDeliveryType: { type: String, default: "authenticated" },
    sourceFileUrl: { type: String, default: "" },
    extractionStatus: { type: String, default: "" },
    status: { type: String, enum: Object.values(DRAFT_STATUS), default: DRAFT_STATUS.DRAFT },
    currentRevision: { type: Number, default: 1 },
    assignedReviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    latestReviewRun: { type: mongoose.Schema.Types.ObjectId, ref: "ReviewRun" },
    submittedAt: { type: Date },
    lastReviewedAt: { type: Date },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

draftSchema.index({ workspace: 1, createdAt: -1 });
draftSchema.index({ workspace: 1, status: 1 });
draftSchema.index({ workspace: 1, creator: 1 });

export const Draft = mongoose.model("Draft", draftSchema);
