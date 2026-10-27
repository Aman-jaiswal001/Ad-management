import { Approval, Comment, Draft, Finding } from "../models/index.js";
import { AUDIT_ACTIONS, DRAFT_STATUS, HIGH_RISK_SEVERITIES, ROLES } from "../config/constants.js";
import { parseBody, assignSchema, commentSchema, reasonSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { writeAudit } from "../services/audit.js";

const TRANSITIONS = {
  submit: [DRAFT_STATUS.DRAFT, DRAFT_STATUS.AI_REVIEWED, DRAFT_STATUS.CHANGES_REQUESTED],
  requestChanges: [
    DRAFT_STATUS.AI_REVIEWED,
    DRAFT_STATUS.SUBMITTED,
    DRAFT_STATUS.RESUBMITTED,
    DRAFT_STATUS.PENDING_APPROVAL,
  ],
  approve: [DRAFT_STATUS.AI_REVIEWED, DRAFT_STATUS.PENDING_APPROVAL, DRAFT_STATUS.RESUBMITTED],
  reject: [DRAFT_STATUS.AI_REVIEWED, DRAFT_STATUS.PENDING_APPROVAL, DRAFT_STATUS.RESUBMITTED],
};

export const submitDraft = asyncHandler(async (req, res) => {
  const draft = await loadDraft(req);
  if (req.membership.role === ROLES.CREATOR && String(draft.creator) !== String(req.user._id)) {
    throw new ApiError(403, "You can only submit your own drafts.");
  }
  const resubmit = draft.status === DRAFT_STATUS.CHANGES_REQUESTED;
  const allowed = [
    DRAFT_STATUS.DRAFT,
    DRAFT_STATUS.SUBMITTED,
    DRAFT_STATUS.AI_REVIEWED,
    DRAFT_STATUS.CHANGES_REQUESTED,
  ];
  if (!allowed.includes(draft.status)) {
    throw new ApiError(400, `Cannot submit a draft in status ${draft.status}.`);
  }
  if (resubmit) {
    draft.status = DRAFT_STATUS.RESUBMITTED;
  } else if (draft.lastReviewedAt || draft.status === DRAFT_STATUS.AI_REVIEWED) {
    draft.status = DRAFT_STATUS.PENDING_APPROVAL;
  } else {
    draft.status = DRAFT_STATUS.SUBMITTED;
  }
  draft.submittedAt = new Date();
  await draft.save();
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: resubmit ? AUDIT_ACTIONS.DRAFT_RESUBMITTED : AUDIT_ACTIONS.DRAFT_SUBMITTED,
    targetType: "Draft",
    targetId: draft._id,
    metadata: { status: draft.status, revision: draft.currentRevision },
  });
  res.json({ draft });
});

export const addComment = asyncHandler(async (req, res) => {
  const { body } = parseBody(commentSchema, req.body);
  const draft = await loadDraft(req);
  const comment = await Comment.create({
    workspace: req.workspaceId,
    draft: draft._id,
    author: req.user._id,
    body,
    revisionNumber: draft.currentRevision,
  });
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.COMMENT_ADDED,
    targetType: "Draft",
    targetId: draft._id,
    metadata: { commentId: String(comment._id) },
  });
  res.status(201).json({ comment: await comment.populate("author", "name email") });
});

export const assignReviewer = asyncHandler(async (req, res) => {
  const { reviewerId } = parseBody(assignSchema, req.body);
  const draft = await loadDraft(req);
  draft.assignedReviewer = reviewerId;
  await draft.save();
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.REVIEWER_ASSIGNED,
    targetType: "Draft",
    targetId: draft._id,
    metadata: { reviewerId },
  });
  res.json({ draft: await draft.populate("assignedReviewer", "name email") });
});

export const requestChanges = asyncHandler(async (req, res) => {
  const { reason } = parseBody(reasonSchema, req.body);
  const draft = await loadDraft(req);
  if (!TRANSITIONS.requestChanges.includes(draft.status)) {
    throw new ApiError(400, `Cannot request changes from status ${draft.status}.`);
  }
  draft.status = DRAFT_STATUS.CHANGES_REQUESTED;
  await draft.save();
  await Approval.create({
    workspace: req.workspaceId,
    draft: draft._id,
    reviewer: req.user._id,
    decision: "changes_requested",
    reason,
    revisionNumber: draft.currentRevision,
  });
  await Comment.create({
    workspace: req.workspaceId,
    draft: draft._id,
    author: req.user._id,
    body: `Changes requested: ${reason}`,
    revisionNumber: draft.currentRevision,
  });
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.CHANGES_REQUESTED,
    targetType: "Draft",
    targetId: draft._id,
    metadata: { reason: reason.slice(0, 200) },
  });
  res.json({ draft });
});

export const approveDraft = asyncHandler(async (req, res) => {
  const reason = req.body?.reason || "Approved";
  const draft = await loadDraft(req);
  if (!TRANSITIONS.approve.includes(draft.status)) {
    throw new ApiError(400, `Cannot approve a draft in status ${draft.status}.`);
  }
  const openHigh = await Finding.countDocuments({
    workspace: req.workspaceId,
    draft: draft._id,
    reviewRun: draft.latestReviewRun,
    severity: { $in: HIGH_RISK_SEVERITIES },
    status: { $in: ["Open", "Escalated"] },
  });
  if (openHigh > 0) {
    throw new ApiError(
      400,
      "High-risk or critical findings still require human resolution (accept, edit, dismiss with reason, or resolve) before approval."
    );
  }
  draft.status = DRAFT_STATUS.APPROVED;
  draft.decidedAt = new Date();
  await draft.save();
  await Approval.create({
    workspace: req.workspaceId,
    draft: draft._id,
    reviewer: req.user._id,
    decision: "approved",
    reason,
    revisionNumber: draft.currentRevision,
  });
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.DRAFT_APPROVED,
    targetType: "Draft",
    targetId: draft._id,
    metadata: { revision: draft.currentRevision },
  });
  res.json({ draft });
});

export const rejectDraft = asyncHandler(async (req, res) => {
  const { reason } = parseBody(reasonSchema, req.body);
  const draft = await loadDraft(req);
  if (!TRANSITIONS.reject.includes(draft.status)) {
    throw new ApiError(400, `Cannot reject a draft in status ${draft.status}.`);
  }
  draft.status = DRAFT_STATUS.REJECTED;
  draft.decidedAt = new Date();
  await draft.save();
  await Approval.create({
    workspace: req.workspaceId,
    draft: draft._id,
    reviewer: req.user._id,
    decision: "rejected",
    reason,
    revisionNumber: draft.currentRevision,
  });
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.DRAFT_REJECTED,
    targetType: "Draft",
    targetId: draft._id,
    metadata: { reason: reason.slice(0, 200) },
  });
  res.json({ draft });
});

async function loadDraft(req) {
  const draft = await Draft.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!draft) throw new ApiError(404, "Draft not found.");
  return draft;
}
