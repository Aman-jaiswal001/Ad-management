import bcrypt from "bcryptjs";
import { User, Workspace, WorkspaceMember } from "../models/index.js";
import { ROLES } from "../config/constants.js";
import { signToken } from "../middleware/auth.js";
import {
  parseBody,
  loginSchema,
  registerSchema,
} from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

function slugify(name) {
  return `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, workspaceName } = parseBody(
    registerSchema,
    req.body,
  );
  const exists = await User.findOne({ email });
  if (exists)
    throw new ApiError(409, "An account with this email already exists.");
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  const wsName = workspaceName || `${name}'s workspace`;
  const workspace = await Workspace.create({
    name: wsName,
    slug: slugify(wsName),
    createdBy: user._id,
  });
  await WorkspaceMember.create({
    workspace: workspace._id,
    user: user._id,
    role: ROLES.ADMIN,
  });
  user.lastWorkspace = workspace._id;
  await user.save();
  const token = signToken(user);
  res.status(201).json({
    token,
    user: serializeUser(user),
    workspace,
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = parseBody(loginSchema, req.body);
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(401, "Invalid email or password.");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid email or password.");
  const token = signToken(user);
  res.json({ token, user: serializeUser(user) });
});

export const me = asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMember.find({
    user: req.user._id,
  }).populate("workspace");
  res.json({
    user: serializeUser(req.user),
    memberships: memberships.map((m) => ({
      id: m._id,
      role: m.role,
      workspace: m.workspace,
    })),
  });
});

export function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    lastWorkspace: user.lastWorkspace,
  };
}
