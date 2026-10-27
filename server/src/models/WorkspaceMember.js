import mongoose from "mongoose";
import { ALL_ROLES, ROLES } from "../config/constants.js";

const workspaceMemberSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ALL_ROLES, default: ROLES.CREATOR, required: true },
  },
  { timestamps: true }
);

workspaceMemberSchema.index({ workspace: 1, user: 1 }, { unique: true });
workspaceMemberSchema.index({ user: 1 });

export const WorkspaceMember = mongoose.model("WorkspaceMember", workspaceMemberSchema);
