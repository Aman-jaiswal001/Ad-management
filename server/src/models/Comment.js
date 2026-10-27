import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    draft: { type: mongoose.Schema.Types.ObjectId, ref: "Draft", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    revisionNumber: { type: Number },
  },
  { timestamps: true }
);

commentSchema.index({ workspace: 1, draft: 1, createdAt: 1 });

export const Comment = mongoose.model("Comment", commentSchema);
