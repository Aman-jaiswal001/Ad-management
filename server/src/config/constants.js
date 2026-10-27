export const ROLES = {
  ADMIN: "ADMIN",
  CREATOR: "CREATOR",
  MANAGER: "MANAGER",
  REVIEWER: "REVIEWER",
};

export const ALL_ROLES = Object.values(ROLES);

export const DRAFT_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  AI_REVIEWED: "AI_REVIEWED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  RESUBMITTED: "RESUBMITTED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export const CONTENT_TYPES = [
  "social_media_post",
  "advertisement",
  "blog_post",
  "email_campaign",
  "product_description",
  "brochure_pdf",
];

export const FINDING_CATEGORIES = [
  "brand_tone_voice",
  "incorrect_product_names",
  "inconsistent_terminology",
  "conflicting_messages",
  "unsupported_claims",
  "outdated_facts",
  "missing_disclaimers",
  "absolute_exaggerated_claims",
  "accessibility",
  "brand_rule_violation",
];

export const SEVERITIES = ["Low", "Medium", "High", "Critical"];

export const FINDING_STATUSES = [
  "Open",
  "Accepted",
  "Edited",
  "Dismissed",
  "Escalated",
  "Resolved",
];

export const ISSUE_KINDS = [
  "confirmed_rule_violation",
  "potential_issue",
  "needs_verification",
  "human_judgment_required",
];

export const SOURCE_STATUS = {
  PENDING: "pending",
  EXTRACTING: "extracting",
  EXTRACTED: "extracted",
  INDEXING: "indexing",
  INDEXED: "indexed",
  ERROR: "error",
};

export const APPROVAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  SUPERSEDED: "superseded",
  REJECTED: "rejected",
};

export const AUDIT_ACTIONS = {
  DRAFT_CREATED: "draft.created",
  DRAFT_UPDATED: "draft.updated",
  DRAFT_SUBMITTED: "draft.submitted",
  DRAFT_RESUBMITTED: "draft.resubmitted",
  REVISION_CREATED: "revision.created",
  SOURCE_UPLOADED: "source.uploaded",
  SOURCE_UPDATED: "source.updated",
  SOURCE_DELETED: "source.deleted",
  SOURCE_REINDEXED: "source.reindexed",
  REVIEW_RUN: "review.executed",
  FINDING_ACCEPTED: "finding.accepted",
  FINDING_EDITED: "finding.edited",
  FINDING_DISMISSED: "finding.dismissed",
  FINDING_ESCALATED: "finding.escalated",
  FINDING_RESOLVED: "finding.resolved",
  COMMENT_ADDED: "comment.added",
  REVIEWER_ASSIGNED: "reviewer.assigned",
  CHANGES_REQUESTED: "changes.requested",
  DRAFT_APPROVED: "draft.approved",
  DRAFT_REJECTED: "draft.rejected",
  ROLE_CHANGED: "member.role_changed",
  MEMBER_ADDED: "member.added",
  MEMBER_REMOVED: "member.removed",
  RULE_CHANGED: "rule.changed",
  CLAIM_CHANGED: "claim.changed",
  TERM_CHANGED: "terminology.changed",
};

export const HIGH_RISK_SEVERITIES = ["High", "Critical"];
