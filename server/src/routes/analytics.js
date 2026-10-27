import { Router } from "express";
import { ROLES } from "../config/constants.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles, requireWorkspace } from "../middleware/workspace.js";
import { findingsAnalytics, listAudit, overview } from "../controllers/analyticsController.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, requireWorkspace, requireRoles(ROLES.ADMIN, ROLES.MANAGER));
analyticsRouter.get("/overview", overview);
analyticsRouter.get("/findings", findingsAnalytics);

export const auditRouter = Router();
auditRouter.use(requireAuth, requireWorkspace, requireRoles(ROLES.ADMIN));
auditRouter.get("/", listAudit);
