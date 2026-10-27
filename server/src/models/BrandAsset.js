import mongoose from "mongoose";
import { APPROVAL_STATUS } from "../config/constants.js";

const brandAssetSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    name: { type: String, required: true },
    assetType: { type: String, default: "other" },
    storagePath: { type: String, default: "" },
    originalFilename: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    version: { type: Number, default: 1 },
    approvalStatus: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.APPROVED,
    },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

brandAssetSchema.index({ workspace: 1, createdAt: -1 });

export const BrandAsset = mongoose.model("BrandAsset", brandAssetSchema);
