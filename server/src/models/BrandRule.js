import mongoose from "mongoose";
import { APPROVAL_STATUS, SEVERITIES } from "../config/constants.js";

const brandRuleSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "brand_rule_violation" },
    severity: { type: String, enum: SEVERITIES, default: "Medium" },
    ruleText: { type: String, required: true },
    exactPhrases: [{ type: String }],
    source: { type: mongoose.Schema.Types.ObjectId, ref: "BrandSource" },
    sourceVersion: { type: Number, default: 1 },
    approvalStatus: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.APPROVED,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

brandRuleSchema.index({ workspace: 1, title: 1 });

export const BrandRule = mongoose.model("BrandRule", brandRuleSchema);
