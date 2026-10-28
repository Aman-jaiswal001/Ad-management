import { Router } from "express";
import { ROLES } from "../config/constants.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles, requireWorkspace } from "../middleware/workspace.js";
import { assetUpload, handleMulterError, sourceUpload, validateFileSignature } from "../middleware/upload.js";
import {
  createClaim,
  createRule,
  createTerminology,
  deleteAsset,
  deleteClaim,
  deleteRule,
  deleteSource,
  deleteTerminology,
  downloadAsset,
  downloadSource,
  getSource,
  listAssets,
  listClaims,
  listRules,
  listSources,
  listTerminology,
  reindexSource,
  updateClaim,
  updateRule,
  updateSource,
  updateTerminology,
  uploadAsset,
  uploadSource,
} from "../controllers/knowledgeController.js";

const admin = requireRoles(ROLES.ADMIN);
const router = Router();
router.use(requireAuth, requireWorkspace);

router.get("/sources", listSources);
router.post("/sources/upload", admin, sourceUpload.single("file"), handleMulterError, validateFileSignature, uploadSource);
router.get("/sources/:id", getSource);
router.patch("/sources/:id", admin, updateSource);
router.post("/sources/:id/reindex", admin, reindexSource);
router.delete("/sources/:id", admin, deleteSource);
router.get("/sources/:id/download", downloadSource);

router.get("/terminology", listTerminology);
router.post("/terminology", admin, createTerminology);
router.put("/terminology/:id", admin, updateTerminology);
router.delete("/terminology/:id", admin, deleteTerminology);

router.get("/claims", listClaims);
router.post("/claims", admin, createClaim);
router.put("/claims/:id", admin, updateClaim);
router.delete("/claims/:id", admin, deleteClaim);

router.get("/rules", listRules);
router.post("/rules", admin, createRule);
router.put("/rules/:id", admin, updateRule);
router.delete("/rules/:id", admin, deleteRule);

router.get("/assets", listAssets);
router.post("/assets", admin, assetUpload.single("file"), handleMulterError, validateFileSignature, uploadAsset);
router.delete("/assets/:id", admin, deleteAsset);
router.get("/assets/:id/download", downloadAsset);

export default router;
