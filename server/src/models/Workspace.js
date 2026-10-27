import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isSyntheticDemo: { type: Boolean, default: false },
    brandVoice: {
      preferredTone: { type: String, default: "" },
      writingPrinciples: [{ type: String }],
      wordsToAvoid: [{ type: String }],
      examples: [{ type: String }],
    },
    settings: {
      chunkSize: { type: Number, default: 800 },
      chunkOverlap: { type: Number, default: 120 },
      retrievalCount: { type: Number, default: 8 },
      requiredDisclaimers: [{ type: String }],
    },
  },
  { timestamps: true }
);

workspaceSchema.index({ slug: 1 }, { unique: true });

export const Workspace = mongoose.model("Workspace", workspaceSchema);
