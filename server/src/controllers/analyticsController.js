import mongoose from "mongoose";
import { Approval, AuditLog, Draft, Finding, ReviewRun } from "../models/index.js";
import { DRAFT_STATUS } from "../config/constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination, paginated } from "../utils/pagination.js";

function dateRange(query) {
  const match = {};
  if (query.from) match.$gte = new Date(query.from);
  if (query.to) match.$lte = new Date(query.to);
  return Object.keys(match).length ? match : null;
}

function wsId(req) {
  return new mongoose.Types.ObjectId(req.workspaceId);
}

export const overview = asyncHandler(async (req, res) => {
  const workspace = wsId(req);
  const range = dateRange(req.query);
  const createdFilter = { workspace };
  if (range) createdFilter.createdAt = range;
  const findingMatch = { workspace, ...(range ? { createdAt: range } : {}) };

  const [
    totalReviews,
    pendingReviews,
    highSeverity,
    approvedDrafts,
    decidedDrafts,
    severityAgg,
    findingsByCategory,
    recentDrafts,
    recentApprovals,
    verification,
    findingActions,
    terminologyFlags,
  ] = await Promise.all([
    ReviewRun.countDocuments({ ...createdFilter, status: "completed" }),
    Draft.countDocuments({
      workspace,
      status: {
        $in: [
          DRAFT_STATUS.SUBMITTED,
          DRAFT_STATUS.AI_REVIEWED,
          DRAFT_STATUS.PENDING_APPROVAL,
          DRAFT_STATUS.RESUBMITTED,
        ],
      },
    }),
    Finding.countDocuments({ ...findingMatch, severity: { $in: ["High", "Critical"] } }),
    Draft.countDocuments({ workspace, status: DRAFT_STATUS.APPROVED }),
    Draft.find({ workspace, submittedAt: { $ne: null }, decidedAt: { $ne: null } }).select(
      "submittedAt decidedAt"
    ),
    Finding.aggregate([{ $match: findingMatch }, { $group: { _id: "$severity", count: { $sum: 1 } } }]),
    Finding.aggregate([
      { $match: findingMatch },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Draft.find(createdFilter).sort({ updatedAt: -1 }).limit(8).populate("creator", "name"),
    Approval.find({ workspace })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("reviewer", "name")
      .populate("draft", "title"),
    Finding.countDocuments({ workspace, issueKind: "needs_verification", status: "Open" }),
    Finding.aggregate([{ $match: { workspace } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Finding.aggregate([
      { $match: { workspace, category: "inconsistent_terminology" } },
      { $group: { _id: "$matchedText", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const turnaroundMs = decidedDrafts
    .map((d) => d.decidedAt - d.submittedAt)
    .filter((n) => Number.isFinite(n) && n >= 0);
  const avgTurnaroundHours = turnaroundMs.length
    ? turnaroundMs.reduce((a, b) => a + b, 0) / turnaroundMs.length / 36e5
    : 0;
  const actions = Object.fromEntries(findingActions.map((x) => [x._id, x.count]));

  res.json({
    totalReviews,
    pendingReviews,
    highSeverityFindings: highSeverity,
    approvedDrafts,
    averageTurnaroundHours: Number(avgTurnaroundHours.toFixed(2)),
    findingsBySeverity: severityAgg,
    findingsByCategory,
    recentDrafts,
    recentApprovals,
    itemsRequiringVerification: verification,
    recurringTerminology: terminologyFlags,
    suggestionStats: {
      accepted: actions.Accepted || 0,
      edited: actions.Edited || 0,
      dismissed: actions.Dismissed || 0,
    },
  });
});

export const findingsAnalytics = asyncHandler(async (req, res) => {
  const range = dateRange(req.query);
  const match = { workspace: wsId(req) };
  if (range) match.createdAt = range;
  const [bySeverity, byCategory, byKind] = await Promise.all([
    Finding.aggregate([{ $match: match }, { $group: { _id: "$severity", count: { $sum: 1 } } }]),
    Finding.aggregate([{ $match: match }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
    Finding.aggregate([{ $match: match }, { $group: { _id: "$issueKind", count: { $sum: 1 } } }]),
  ]);
  res.json({ bySeverity, byCategory, byKind });
});

export const listAudit = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { workspace: req.workspaceId };
  if (req.query.action) filter.action = req.query.action;
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  res.json(paginated(items, total, { page, limit }));
});
