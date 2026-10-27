import { Router } from "express";
import {
  addMember,
  createWorkspace,
  getWorkspace,
  listMembers,
  listWorkspaces,
  removeMember,
  updateMember,
  updateWorkspace,
} from "../controllers/workspaceController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles, requireWorkspace } from "../middleware/workspace.js";
import { ROLES } from "../config/constants.js";

const router = Router();
router.use(requireAuth);
router.get("/", listWorkspaces);
router.post("/", createWorkspace);
router.get("/:workspaceId", getWorkspace);

router.patch("/:workspaceId", requireWorkspace, requireRoles(ROLES.ADMIN), updateWorkspace);
router.get("/:workspaceId/members", requireWorkspace, requireRoles(ROLES.ADMIN, ROLES.MANAGER), listMembers);
router.post("/:workspaceId/members", requireWorkspace, requireRoles(ROLES.ADMIN), addMember);
router.patch(
  "/:workspaceId/members/:memberId",
  requireWorkspace,
  requireRoles(ROLES.ADMIN),
  updateMember
);
router.delete(
  "/:workspaceId/members/:memberId",
  requireWorkspace,
  requireRoles(ROLES.ADMIN),
  removeMember
);

export default router;
