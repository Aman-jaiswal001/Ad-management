import { Router } from "express";
import { ROLES } from "../config/constants.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles, requireWorkspace } from "../middleware/workspace.js";
import {
  escalateFinding,
  getReview,
  patchFinding,
  rerunReview,
  startReview,
} from "../controllers/reviewController.js";

const router = Router();
router.use(requireAuth, requireWorkspace);
router.post("/", requireRoles(ROLES.ADMIN, ROLES.CREATOR, ROLES.MANAGER, ROLES.REVIEWER), startReview);
router.get("/:id", getReview);
router.post("/:id/rerun", requireRoles(ROLES.ADMIN, ROLES.CREATOR, ROLES.MANAGER), rerunReview);
export default router;

export const findingRouter = Router();
findingRouter.use(requireAuth, requireWorkspace);
findingRouter.patch("/:id", patchFinding);
findingRouter.post("/:id/escalate", escalateFinding);
