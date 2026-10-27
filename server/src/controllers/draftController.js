import {
  Comment,
  Draft,
  DraftRevision,
  Finding,
  ReviewRun,
} from "../models/index.js";
import { AUDIT_ACTIONS, DRAFT_STATUS, ROLES } from "../config/constants.js";
import { parseBody, draftCreateSchema, draftUpdateSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { paginated, parsePagination } from "../utils/pagination.js";
import { writeAudit } from "../services/audit.js";
import { normalizeText } from "../utils/text.js";
import { extractFromFile } from "../services/documents/extract.js";
import { resolveStored, saveBuffer } from "../services/documents/storage.js";

export const listDrafts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { workspace: req.workspaceId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.mine === "true" || req.membership.role === ROLES.CREATOR) {
    filter.creator = req.user._id;
  }
  if (req.query.queue === "true") {
    filter.status = {
      $in: [
        DRAFT_STATUS.SUBMITTED,
        DRAFT_STATUS.AI_REVIEWED,
        DRAFT_STATUS.RESUBMITTED,
        DRAFT_STATUS.PENDING_APPROVAL,
        DRAFT_STATUS.CHANGES_REQUESTED,
      ],
    };
    delete filter.creator;
  }
  const [items, total] = await Promise.all([
    Draft.find(filter)
      .populate("creator", "name email")
      .populate("assignedReviewer", "name email")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    Draft.countDocuments(filter),
  ]);
  res.json(paginated(items, total, { page, limit }));
});

export const createDraft = asyncHandler(async (req, res) => {
  const data = parseBody(draftCreateSchema, {
    title: req.body.title,
    contentType: req.body.contentType,
    content: req.body.content || "",
  });
  let content = normalizeText(data.content);
  let sourceFilePath = "";
  let sourceFilename = "";
  let extractionStatus = "";
  if (req.file) {
    sourceFilePath = await saveBuffer({
      workspaceId: req.workspaceId,
      folder: "drafts",
      originalName: req.file.originalname,
      buffer: req.file.buffer,
    });
    sourceFilename = req.file.originalname;
    extractionStatus = "extracting";
    const extracted = await extractFromFile(
      resolveStored(sourceFilePath),
      req.file.mimetype,
      req.file.originalname
    );
    content = extracted.text;
    extractionStatus = "extracted";
  }
  if (!content) throw new ApiError(400, "Paste content or upload a PDF/text file.");
  const draft = await Draft.create({
    workspace: req.workspaceId,
    creator: req.user._id,
    title: data.title,
    contentType: data.contentType,
    originalContent: content,
    currentContent: content,
    sourceFilePath,
    sourceFilename,
    extractionStatus,
    status: DRAFT_STATUS.DRAFT,
    currentRevision: 1,
  });
  await DraftRevision.create({
    workspace: req.workspaceId,
    draft: draft._id,
    revisionNumber: 1,
    content,
    createdBy: req.user._id,
    note: "Original",
  });
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.DRAFT_CREATED,
    targetType: "Draft",
    targetId: draft._id,
    metadata: { title: draft.title, contentType: draft.contentType },
  });
  res.status(201).json({ draft });
});

export const getDraft = asyncHandler(async (req, res) => {
  const draft = await Draft.findOne({ _id: req.params.id, workspace: req.workspaceId })
    .populate("creator", "name email")
    .populate("assignedReviewer", "name email")
    .populate("latestReviewRun");
  if (!draft) throw new ApiError(404, "Draft not found.");
  if (req.membership.role === ROLES.CREATOR && String(draft.creator._id) !== String(req.user._id)) {
    throw new ApiError(403, "Creators may only view their own drafts.");
  }
  const comments = await Comment.find({ workspace: req.workspaceId, draft: draft._id })
    .populate("author", "name email")
    .sort({ createdAt: 1 });
  res.json({ draft, comments });
});

export const updateDraft = asyncHandler(async (req, res) => {
  const data = parseBody(draftUpdateSchema, req.body);
  const draft = await Draft.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!draft) throw new ApiError(404, "Draft not found.");
  assertEditable(draft, req);
  if (data.title) draft.title = data.title;
  if (typeof data.content === "string" && data.content !== draft.currentContent) {
    draft.currentContent = normalizeText(data.content);
    draft.currentRevision += 1;
    await DraftRevision.create({
      workspace: req.workspaceId,
      draft: draft._id,
      revisionNumber: draft.currentRevision,
      content: draft.currentContent,
      createdBy: req.user._id,
      note: data.note || "Content edit",
    });
    await writeAudit({
      workspace: req.workspaceId,
      actor: req.user._id,
      action: AUDIT_ACTIONS.REVISION_CREATED,
      targetType: "Draft",
      targetId: draft._id,
      metadata: { revision: draft.currentRevision },
    });
  }
  await draft.save();
  res.json({ draft });
});

export const listRevisions = asyncHandler(async (req, res) => {
  const draft = await Draft.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!draft) throw new ApiError(404, "Draft not found.");
  const items = await DraftRevision.find({ draft: draft._id, workspace: req.workspaceId }).sort({
    revisionNumber: 1,
  });
  res.json({ items, originalContent: draft.originalContent });
});

export const listFindings = asyncHandler(async (req, res) => {
  const draft = await Draft.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!draft) throw new ApiError(404, "Draft not found.");
  const filter = { workspace: req.workspaceId, draft: draft._id };
  if (req.query.reviewRun) filter.reviewRun = req.query.reviewRun;
  else if (draft.latestReviewRun) filter.reviewRun = draft.latestReviewRun;
  const items = await Finding.find(filter).sort({ severity: 1, createdAt: 1 });
  res.json({ items });
});

export const listReviewRuns = asyncHandler(async (req, res) => {
  const items = await ReviewRun.find({ workspace: req.workspaceId, draft: req.params.id }).sort({
    createdAt: -1,
  });
  res.json({ items });
});

function assertEditable(draft, req) {
  if ([DRAFT_STATUS.APPROVED, DRAFT_STATUS.REJECTED].includes(draft.status)) {
    throw new ApiError(400, "Approved or rejected drafts cannot be edited.");
  }
  if (req.membership.role === ROLES.CREATOR && String(draft.creator) !== String(req.user._id)) {
    throw new ApiError(403, "You can only edit your own drafts.");
  }
}
