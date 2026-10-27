import mongoose from "mongoose";
import { APPROVAL_STATUS, SOURCE_STATUS } from "../config/constants.js";

const brandSourceSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    name: { type: String, required: true },
    originalFilename: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    storagePath: { type: String, default: "" },
    extractedText: { type: String, default: "" },
    version: { type: Number, default: 1 },
    isActiveVersion: { type: Boolean, default: true },
    supersedes: { type: mongoose.Schema.Types.ObjectId, ref: "BrandSource" },
    approvalStatus: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.PENDING,
    },
    uploadStatus: { type: String, default: "stored" },
    extractionStatus: {
      type: String,
      enum: Object.values(SOURCE_STATUS),
      default: SOURCE_STATUS.PENDING,
    },
    indexedChunkCount: { type: Number, default: 0 },
    indexingError: { type: String, default: "" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

brandSourceSchema.index({ workspace: 1, createdAt: -1 });
brandSourceSchema.index({ workspace: 1, isActiveVersion: 1, approvalStatus: 1 });

export const BrandSource = mongoose.model("BrandSource", brandSourceSchema);
