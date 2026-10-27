import mongoose from "mongoose";

const approvalSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    draft: { type: mongoose.Schema.Types.ObjectId, ref: "Draft", required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    decision: { type: String, enum: ["approved", "rejected", "changes_requested"], required: true },
    reason: { type: String, default: "" },
    revisionNumber: { type: Number, required: true },
  },
  { timestamps: true }
);

approvalSchema.index({ workspace: 1, draft: 1, createdAt: -1 });

export const Approval = mongoose.model("Approval", approvalSchema);
