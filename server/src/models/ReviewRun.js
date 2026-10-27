import mongoose from "mongoose";

const reviewRunSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    draft: { type: mongoose.Schema.Types.ObjectId, ref: "Draft", required: true },
    revisionNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
    },
    providerUsed: { type: String, default: "" },
    fallbackUsed: { type: Boolean, default: false },
    retrievalCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
    deterministicFindingCount: { type: Number, default: 0 },
    aiFindingCount: { type: Number, default: 0 },
    tokenUsage: {
      prompt: { type: Number, default: 0 },
      completion: { type: Number, default: 0 },
    },
    retrievedSourceIds: [{ type: String }],
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

reviewRunSchema.index({ workspace: 1, draft: 1, createdAt: -1 });
reviewRunSchema.index({ draft: 1, createdAt: -1 });

export const ReviewRun = mongoose.model("ReviewRun", reviewRunSchema);
