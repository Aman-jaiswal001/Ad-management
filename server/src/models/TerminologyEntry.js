import mongoose from "mongoose";

const terminologyEntrySchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    officialTerm: { type: String, required: true },
    prohibitedVariants: [{ type: String }],
    explanation: { type: String, default: "" },
    suggestedReplacement: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

terminologyEntrySchema.index({ workspace: 1, officialTerm: 1 });

export const TerminologyEntry = mongoose.model("TerminologyEntry", terminologyEntrySchema);
