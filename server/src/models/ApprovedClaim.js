import mongoose from "mongoose";
import { APPROVAL_STATUS } from "../config/constants.js";

const approvedClaimSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    claimText: { type: String, required: true },
    supportingEvidence: { type: String, default: "" },
    source: { type: mongoose.Schema.Types.ObjectId, ref: "BrandSource" },
    sourceOwner: { type: String, default: "" },
    approvalStatus: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.APPROVED,
    },
    expiresAt: { type: Date },
    reviewBy: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

approvedClaimSchema.index({ workspace: 1, createdAt: -1 });

export const ApprovedClaim = mongoose.model("ApprovedClaim", approvedClaimSchema);
