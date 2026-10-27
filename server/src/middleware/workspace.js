import mongoose from "mongoose";
import { WorkspaceMember } from "../models/WorkspaceMember.js";
import { ApiError } from "../utils/ApiError.js";

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.membership) return next(new ApiError(403, "Workspace membership required."));
    if (!roles.includes(req.membership.role)) {
      return next(new ApiError(403, "You do not have permission to perform this action."));
    }
    next();
  };
}

export async function requireWorkspace(req, res, next) {
  try {
    const workspaceId =
      req.headers["x-workspace-id"] || req.params.workspaceId || req.query.workspaceId;
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) {
      throw new ApiError(400, "A valid X-Workspace-Id header is required.");
    }
    const membership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
    });
    if (!membership) {
      throw new ApiError(403, "You are not a member of this workspace.");
    }
    req.workspaceId = workspaceId;
    req.membership = membership;
    next();
  } catch (err) {
    next(err);
  }
}

export function workspaceFilter(req) {
  return { workspace: req.workspaceId };
}
