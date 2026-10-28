import { Router } from "express";
import { ROLES } from "../config/constants.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles, requireWorkspace } from "../middleware/workspace.js";
import { draftUpload, handleMulterError, validateFileSignature } from "../middleware/upload.js";
import {
  createDraft,
  getDraft,
  listDrafts,
  listFindings,
  listReviewRuns,
  listRevisions,
  updateDraft,
} from "../controllers/draftController.js";
import {
  addComment,
  approveDraft,
  assignReviewer,
  rejectDraft,
  requestChanges,
  submitDraft,
} from "../controllers/workflowController.js";

const router = Router();
router.use(requireAuth, requireWorkspace);

router.get("/", listDrafts);
router.post("/", requireRoles(ROLES.ADMIN, ROLES.CREATOR), draftUpload.single("file"), handleMulterError, validateFileSignature, createDraft);
router.get("/:id", getDraft);
router.put("/:id", requireRoles(ROLES.ADMIN, ROLES.CREATOR), updateDraft);
router.get("/:id/revisions", listRevisions);
router.get("/:id/findings", listFindings);
router.get("/:id/reviews", listReviewRuns);
router.post("/:id/comments", addComment);
router.post("/:id/submit", requireRoles(ROLES.ADMIN, ROLES.CREATOR), submitDraft);
router.post("/:id/assign", requireRoles(ROLES.ADMIN, ROLES.MANAGER), assignReviewer);
router.post("/:id/request-changes", requireRoles(ROLES.ADMIN, ROLES.MANAGER, ROLES.REVIEWER), requestChanges);
router.post("/:id/approve", requireRoles(ROLES.ADMIN, ROLES.REVIEWER), approveDraft);
router.post("/:id/reject", requireRoles(ROLES.ADMIN, ROLES.REVIEWER), rejectDraft);

export default router;
