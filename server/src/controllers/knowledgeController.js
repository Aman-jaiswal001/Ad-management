import { BrandAsset, BrandRule, BrandSource, ApprovedClaim, TerminologyEntry } from "../models/index.js";
import { APPROVAL_STATUS, AUDIT_ACTIONS, ROLES, SOURCE_STATUS } from "../config/constants.js";
import { parseBody, claimSchema, ruleSchema, terminologySchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { paginated, parsePagination } from "../utils/pagination.js";
import { writeAudit } from "../services/audit.js";
import { extractFromBuffer } from "../services/documents/extract.js";
import { getCloudinaryUrl, removeLegacyStored, removeStored, saveBuffer } from "../services/documents/storage.js";
import { deleteSourcePoints } from "../services/rag/qdrant.js";
import { indexBrandSource } from "../services/rag/indexSource.js";
import { Workspace } from "../models/Workspace.js";

export const listSources = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { workspace: req.workspaceId };
  const [items, total] = await Promise.all([
    BrandSource.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    BrandSource.countDocuments(filter),
  ]);
  res.json(paginated(items, total, { page, limit }));
});

export const uploadSource = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "A PDF or text file is required.");
  const name = req.body.name || req.file.originalname;
  const cloud = await saveBuffer({
    workspaceId: req.workspaceId,
    folder: "sources",
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    buffer: req.file.buffer,
  });
  let source;
  try {
    source = await BrandSource.create({
    workspace: req.workspaceId,
    name,
    originalFilename: req.file.originalname,
    mimeType: req.file.mimetype,
    ...cloudFields(cloud),
    extractionStatus: SOURCE_STATUS.EXTRACTING,
    uploadedBy: req.user._id,
    approvalStatus: req.body.approvalStatus || APPROVAL_STATUS.APPROVED,
    isActiveVersion: true,
    version: Number(req.body.version || 1),
    });
  } catch (err) {
    await removeStored(cloud.publicId, cloud.resourceType, cloud.deliveryType).catch(() => {});
    throw err;
  }
  try {
    const extracted = await extractFromBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );
    source.extractedText = extracted.text;
    source.extractionStatus = SOURCE_STATUS.EXTRACTED;
    await source.save();
  } catch (err) {
    await removeStored(source.cloudinaryPublicId, source.cloudinaryResourceType, source.cloudinaryDeliveryType).catch(() => {});
    await source.deleteOne().catch(() => {});
    source.extractionStatus = SOURCE_STATUS.ERROR;
    source.indexingError = err.status && err.status < 500 ? err.message : "Text extraction failed. Verify the file is a valid PDF or UTF-8 text document.";
    await source.save();
    throw err;
  }
  if (String(req.body.reindex) !== "false") {
    const workspace = await Workspace.findById(req.workspaceId);
    try {
      await indexBrandSource(source, {
        chunkSize: workspace.settings?.chunkSize,
        chunkOverlap: workspace.settings?.chunkOverlap,
      });
    } catch (err) {
      await writeAudit({
        workspace: req.workspaceId,
        actor: req.user._id,
        action: AUDIT_ACTIONS.SOURCE_UPLOADED,
        targetType: "BrandSource",
        targetId: source._id,
        metadata: { name, indexed: false, error: err.message },
      });
      return res.status(201).json({
        source,
        warning: `File saved and extracted, but indexing failed: ${err.message}`,
      });
    }
  }
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.SOURCE_UPLOADED,
    targetType: "BrandSource",
    targetId: source._id,
    metadata: { name, version: source.version },
  });
  res.status(201).json({ source });
});

export const getSource = asyncHandler(async (req, res) => {
  const source = await BrandSource.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!source) throw new ApiError(404, "Source not found.");
  res.json({ source });
});

export const updateSource = asyncHandler(async (req, res) => {
  const source = await BrandSource.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!source) throw new ApiError(404, "Source not found.");
  const { approvalStatus, isActiveVersion, name } = req.body;
  if (name) source.name = name;
  if (approvalStatus) source.approvalStatus = approvalStatus;
  if (typeof isActiveVersion === "boolean" || isActiveVersion === "true" || isActiveVersion === "false") {
    const active = isActiveVersion === true || isActiveVersion === "true";
    source.isActiveVersion = active;
    if (active) {
      await BrandSource.updateMany(
        { workspace: req.workspaceId, name: source.name, _id: { $ne: source._id } },
        { $set: { isActiveVersion: false, approvalStatus: APPROVAL_STATUS.SUPERSEDED } }
      );
    }
  }
  await source.save();
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.SOURCE_UPDATED,
    targetType: "BrandSource",
    targetId: source._id,
    metadata: { approvalStatus: source.approvalStatus, isActiveVersion: source.isActiveVersion },
  });
  res.json({ source });
});

export const reindexSource = asyncHandler(async (req, res) => {
  const source = await BrandSource.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!source) throw new ApiError(404, "Source not found.");
  const workspace = await Workspace.findById(req.workspaceId);
  await indexBrandSource(source, {
    chunkSize: workspace.settings?.chunkSize,
    chunkOverlap: workspace.settings?.chunkOverlap,
  });
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.SOURCE_REINDEXED,
    targetType: "BrandSource",
    targetId: source._id,
    metadata: { chunks: source.indexedChunkCount },
  });
  res.json({ source });
});

export const deleteSource = asyncHandler(async (req, res) => {
  const source = await BrandSource.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!source) throw new ApiError(404, "Source not found.");
  if (source.cloudinaryPublicId) await removeStored(source.cloudinaryPublicId, source.cloudinaryResourceType, source.cloudinaryDeliveryType);
  else await removeLegacyStored(source.storagePath);
  await deleteSourcePoints(req.workspaceId, source._id).catch(() => {});
  await source.deleteOne();
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.SOURCE_DELETED,
    targetType: "BrandSource",
    targetId: source._id,
    metadata: { name: source.name },
  });
  res.json({ ok: true });
});

export const downloadSource = asyncHandler(async (req, res) => {
  const source = await BrandSource.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!source || (!source.cloudinaryPublicId && !source.storagePath)) throw new ApiError(404, "File not found.");
  if (!source.cloudinaryPublicId) throw new ApiError(410, "This legacy file is no longer available from local storage.");
  res.redirect(302, getCloudinaryUrl(source.cloudinaryPublicId, source.cloudinaryResourceType, source.cloudinaryDeliveryType, source.format));
});

export const listTerminology = asyncHandler(async (req, res) => {
  const items = await TerminologyEntry.find({ workspace: req.workspaceId }).sort({ officialTerm: 1 });
  res.json({ items });
});

export const createTerminology = asyncHandler(async (req, res) => {
  const data = parseBody(terminologySchema, req.body);
  const item = await TerminologyEntry.create({ ...data, workspace: req.workspaceId, createdBy: req.user._id });
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.TERM_CHANGED,
    targetType: "TerminologyEntry",
    targetId: item._id,
    metadata: { officialTerm: item.officialTerm },
  });
  res.status(201).json({ item });
});

export const updateTerminology = asyncHandler(async (req, res) => {
  const data = parseBody(terminologySchema, req.body);
  const item = await TerminologyEntry.findOneAndUpdate(
    { _id: req.params.id, workspace: req.workspaceId },
    data,
    { new: true }
  );
  if (!item) throw new ApiError(404, "Terminology entry not found.");
  res.json({ item });
});

export const deleteTerminology = asyncHandler(async (req, res) => {
  const item = await TerminologyEntry.findOneAndDelete({ _id: req.params.id, workspace: req.workspaceId });
  if (!item) throw new ApiError(404, "Terminology entry not found.");
  res.json({ ok: true });
});

export const listClaims = asyncHandler(async (req, res) => {
  const items = await ApprovedClaim.find({ workspace: req.workspaceId }).sort({ updatedAt: -1 });
  res.json({ items });
});

export const createClaim = asyncHandler(async (req, res) => {
  const data = parseBody(claimSchema, req.body);
  const item = await ApprovedClaim.create({
    ...data,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    reviewBy: data.reviewBy ? new Date(data.reviewBy) : undefined,
    workspace: req.workspaceId,
    createdBy: req.user._id,
  });
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.CLAIM_CHANGED,
    targetType: "ApprovedClaim",
    targetId: item._id,
    metadata: { claim: item.claimText.slice(0, 80) },
  });
  res.status(201).json({ item });
});

export const updateClaim = asyncHandler(async (req, res) => {
  const data = parseBody(claimSchema, req.body);
  const item = await ApprovedClaim.findOneAndUpdate(
    { _id: req.params.id, workspace: req.workspaceId },
    {
      ...data,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      reviewBy: data.reviewBy ? new Date(data.reviewBy) : undefined,
    },
    { new: true }
  );
  if (!item) throw new ApiError(404, "Claim not found.");
  res.json({ item });
});

export const deleteClaim = asyncHandler(async (req, res) => {
  const item = await ApprovedClaim.findOneAndDelete({ _id: req.params.id, workspace: req.workspaceId });
  if (!item) throw new ApiError(404, "Claim not found.");
  res.json({ ok: true });
});

export const listRules = asyncHandler(async (req, res) => {
  const items = await BrandRule.find({ workspace: req.workspaceId }).sort({ createdAt: -1 });
  res.json({ items });
});

export const createRule = asyncHandler(async (req, res) => {
  const data = parseBody(ruleSchema, req.body);
  const item = await BrandRule.create({ ...data, workspace: req.workspaceId, createdBy: req.user._id });
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.RULE_CHANGED,
    targetType: "BrandRule",
    targetId: item._id,
    metadata: { title: item.title },
  });
  res.status(201).json({ item });
});

export const updateRule = asyncHandler(async (req, res) => {
  const data = parseBody(ruleSchema, req.body);
  const item = await BrandRule.findOneAndUpdate(
    { _id: req.params.id, workspace: req.workspaceId },
    data,
    { new: true }
  );
  if (!item) throw new ApiError(404, "Rule not found.");
  res.json({ item });
});

export const deleteRule = asyncHandler(async (req, res) => {
  const item = await BrandRule.findOneAndDelete({ _id: req.params.id, workspace: req.workspaceId });
  if (!item) throw new ApiError(404, "Rule not found.");
  res.json({ ok: true });
});

export const listAssets = asyncHandler(async (req, res) => {
  const items = await BrandAsset.find({ workspace: req.workspaceId }).sort({ createdAt: -1 });
  res.json({ items });
});

export const uploadAsset = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "An asset file is required.");
  const cloud = await saveBuffer({
    workspaceId: req.workspaceId,
    folder: "assets",
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    buffer: req.file.buffer,
  });
  let item;
  try {
    item = await BrandAsset.create({
    workspace: req.workspaceId,
    name: req.body.name || req.file.originalname,
    assetType: req.body.assetType || "file",
    ...cloudFields(cloud),
    originalFilename: req.file.originalname,
    mimeType: req.file.mimetype,
    version: Number(req.body.version || 1),
    approvalStatus: req.body.approvalStatus || APPROVAL_STATUS.APPROVED,
    uploadedBy: req.user._id,
    });
  } catch (err) {
    await removeStored(cloud.publicId, cloud.resourceType, cloud.deliveryType).catch(() => {});
    throw err;
  }
  res.status(201).json({ item });
});

export const deleteAsset = asyncHandler(async (req, res) => {
  const item = await BrandAsset.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!item) throw new ApiError(404, "Asset not found.");
  if (item.cloudinaryPublicId) await removeStored(item.cloudinaryPublicId, item.cloudinaryResourceType, item.cloudinaryDeliveryType);
  else await removeLegacyStored(item.storagePath);
  await item.deleteOne();
  res.json({ ok: true });
});

export const downloadAsset = asyncHandler(async (req, res) => {
  const item = await BrandAsset.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!item || (!item.cloudinaryPublicId && !item.storagePath)) throw new ApiError(404, "File not found.");
  if (!item.cloudinaryPublicId) throw new ApiError(410, "This legacy file is no longer available from local storage.");
  res.redirect(302, getCloudinaryUrl(item.cloudinaryPublicId, item.cloudinaryResourceType, item.cloudinaryDeliveryType, item.format));
});

function cloudFields(cloud) {
  return {
    cloudinaryPublicId: cloud.publicId,
    cloudinaryResourceType: cloud.resourceType,
    cloudinaryDeliveryType: cloud.deliveryType,
    secureUrl: cloud.secureUrl,
    fileSize: cloud.bytes,
    format: cloud.format,
  };
}

export const adminOnly = [ROLES.ADMIN];
