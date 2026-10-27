import mongoose from "mongoose";

const draftRevisionSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    draft: { type: mongoose.Schema.Types.ObjectId, ref: "Draft", required: true },
    revisionNumber: { type: Number, required: true },
    content: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: { type: String, default: "" },
    acceptedSuggestions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Finding" }],
    editedSuggestions: [
      {
        finding: { type: mongoose.Schema.Types.ObjectId, ref: "Finding" },
        text: String,
      },
    ],
    dismissedFindings: [
      {
        finding: { type: mongoose.Schema.Types.ObjectId, ref: "Finding" },
        reason: String,
      },
    ],
  },
  { timestamps: true }
);

draftRevisionSchema.index({ draft: 1, revisionNumber: 1 }, { unique: true });
draftRevisionSchema.index({ workspace: 1, draft: 1 });

export const DraftRevision = mongoose.model("DraftRevision", draftRevisionSchema);
