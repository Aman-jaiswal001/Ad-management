import { Draft, Finding, ReviewRun } from "../models/index.js";
import { AUDIT_ACTIONS, DRAFT_STATUS, HIGH_RISK_SEVERITIES, ROLES } from "../config/constants.js";
import { parseBody, findingPatchSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { writeAudit } from "../services/audit.js";
import { runContentReview } from "../services/review/pipeline.js";
import { normalizeText } from "../utils/text.js";
import { DraftRevision } from "../models/DraftRevision.js";

export const startReview = asyncHandler(async (req, res) => {
  const draftId = req.body.draftId;
  const draft = await Draft.findOne({ _id: draftId, workspace: req.workspaceId });
  if (!draft) throw new ApiError(404, "Draft not found.");
  if (req.membership.role === ROLES.CREATOR && String(draft.creator) !== String(req.user._id)) {
    throw new ApiError(403, "You can only review your own drafts.");
  }
  if (draft.status === DRAFT_STATUS.DRAFT) draft.status = DRAFT_STATUS.SUBMITTED;
  await draft.save();
  try {
    const result = await runContentReview({
      draftId: draft._id,
      workspaceId: req.workspaceId,
      userId: req.user._id,
    });
    res.status(201).json(result);
  } catch (err) {
    const status = err.status || 503;
    res.status(status).json({
      error: err.message,
      code: err.code,
      draftId: draft._id,
      partial: err.partial
        ? {
            run: err.partial.run,
            findings: err.partial.findings,
          }
        : undefined,
    });
  }
});

export const getReview = asyncHandler(async (req, res) => {
  const run = await ReviewRun.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!run) throw new ApiError(404, "Review run not found.");
  const findings = await Finding.find({ reviewRun: run._id, workspace: req.workspaceId });
  res.json({ run, findings });
});

export const rerunReview = asyncHandler(async (req, res) => {
  const run = await ReviewRun.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!run) throw new ApiError(404, "Review run not found.");
  const result = await runContentReview({
    draftId: run.draft,
    workspaceId: req.workspaceId,
    userId: req.user._id,
  });
  res.status(201).json(result);
});

export const patchFinding = asyncHandler(async (req, res) => {
  const data = parseBody(findingPatchSchema, req.body);
  const finding = await Finding.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!finding) throw new ApiError(404, "Finding not found.");
  const draft = await Draft.findOne({ _id: finding.draft, workspace: req.workspaceId });
  finding.status = data.status;
  finding.actedBy = req.user._id;
  if (data.status === "Dismissed") {
    if (!data.reason) throw new ApiError(400, "A reason is required to dismiss a finding.");
    finding.dismissReason = data.reason;
  }
  if (data.status === "Edited") {
    finding.editedSuggestion = data.editedSuggestion || finding.suggestedCorrection;
  }
  await finding.save();

  let action = AUDIT_ACTIONS.FINDING_RESOLVED;
  if (data.status === "Accepted") action = AUDIT_ACTIONS.FINDING_ACCEPTED;
  if (data.status === "Edited") action = AUDIT_ACTIONS.FINDING_EDITED;
  if (data.status === "Dismissed") action = AUDIT_ACTIONS.FINDING_DISMISSED;
  if (data.status === "Escalated") action = AUDIT_ACTIONS.FINDING_ESCALATED;

  if (data.status === "Accepted" && finding.suggestedCorrection) {
    applyTextReplacement(draft, finding.matchedText, finding.suggestedCorrection);
    await bumpRevision(draft, req, `Accepted ${finding.publicId}`, {
      acceptedSuggestions: [finding._id],
    });
  }
  if (data.status === "Edited" && finding.editedSuggestion && finding.matchedText) {
    applyTextReplacement(draft, finding.matchedText, finding.editedSuggestion);
    await bumpRevision(draft, req, `Edited ${finding.publicId}`, {
      editedSuggestions: [{ finding: finding._id, text: finding.editedSuggestion }],
    });
  }
  if (data.status === "Dismissed") {
    const latest = await DraftRevision.findOne({
      draft: draft._id,
      revisionNumber: draft.currentRevision,
    });
    if (latest) {
      latest.dismissedFindings.push({ finding: finding._id, reason: data.reason });
      await latest.save();
    }
  }

  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action,
    targetType: "Finding",
    targetId: finding._id,
    metadata: { publicId: finding.publicId, status: data.status },
  });
  res.json({ finding, draft });
});

export const escalateFinding = asyncHandler(async (req, res) => {
  const finding = await Finding.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!finding) throw new ApiError(404, "Finding not found.");
  finding.status = "Escalated";
  finding.requiresHumanReview = true;
  finding.actedBy = req.user._id;
  await finding.save();
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.FINDING_ESCALATED,
    targetType: "Finding",
    targetId: finding._id,
    metadata: { publicId: finding.publicId, severity: finding.severity },
  });
  res.json({ finding });
});

function applyTextReplacement(draft, matched, replacement) {
  if (!matched) {
    draft.currentContent = `${draft.currentContent}\n\n${replacement}`.trim();
    return;
  }
  draft.currentContent = normalizeText(draft.currentContent.replace(matched, replacement));
}

async function bumpRevision(draft, req, note, extras) {
  draft.currentRevision += 1;
  await draft.save();
  await DraftRevision.create({
    workspace: req.workspaceId,
    draft: draft._id,
    revisionNumber: draft.currentRevision,
    content: draft.currentContent,
    createdBy: req.user._id,
    note,
    ...extras,
  });
}

export { HIGH_RISK_SEVERITIES };
