import { User, Workspace, WorkspaceMember } from "../models/index.js";
import { ROLES, AUDIT_ACTIONS } from "../config/constants.js";
import { parseBody, memberSchema, roleSchema, workspaceCreateSchema, workspaceUpdateSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { writeAudit } from "../services/audit.js";

function slugify(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
}

export const listWorkspaces = asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMember.find({ user: req.user._id }).populate("workspace");
  res.json({
    items: memberships.map((m) => ({
      role: m.role,
      workspace: m.workspace,
    })),
  });
});

export const createWorkspace = asyncHandler(async (req, res) => {
  const { name } = parseBody(workspaceCreateSchema, req.body);
  const workspace = await Workspace.create({
    name,
    slug: slugify(name),
    createdBy: req.user._id,
  });
  await WorkspaceMember.create({ workspace: workspace._id, user: req.user._id, role: ROLES.ADMIN });
  req.user.lastWorkspace = workspace._id;
  await req.user.save();
  res.status(201).json({ workspace, role: ROLES.ADMIN });
});

export const getWorkspace = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) throw new ApiError(404, "Workspace not found.");
  const membership = await WorkspaceMember.findOne({
    workspace: workspace._id,
    user: req.user._id,
  });
  if (!membership) throw new ApiError(403, "You are not a member of this workspace.");
  res.json({ workspace, role: membership.role });
});

export const updateWorkspace = asyncHandler(async (req, res) => {
  const data = parseBody(workspaceUpdateSchema, req.body);
  const workspace = await Workspace.findById(req.workspaceId);
  if (!workspace) throw new ApiError(404, "Workspace not found.");
  if (data.name) workspace.name = data.name;
  if (data.brandVoice) workspace.brandVoice = { ...workspace.brandVoice, ...data.brandVoice };
  if (data.settings) workspace.settings = { ...workspace.settings, ...data.settings };
  await workspace.save();
  res.json({ workspace });
});

export const listMembers = asyncHandler(async (req, res) => {
  const members = await WorkspaceMember.find({ workspace: req.workspaceId }).populate(
    "user",
    "name email"
  );
  res.json({ items: members });
});

export const addMember = asyncHandler(async (req, res) => {
  const { email, role } = parseBody(memberSchema, req.body);
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "No user with that email. They must register first.");
  const existing = await WorkspaceMember.findOne({ workspace: req.workspaceId, user: user._id });
  if (existing) throw new ApiError(409, "User is already a member.");
  const member = await WorkspaceMember.create({
    workspace: req.workspaceId,
    user: user._id,
    role,
  });
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.MEMBER_ADDED,
    targetType: "WorkspaceMember",
    targetId: member._id,
    metadata: { email, role },
  });
  res.status(201).json({ member: await member.populate("user", "name email") });
});

export const updateMember = asyncHandler(async (req, res) => {
  const { role } = parseBody(roleSchema, req.body);
  const member = await WorkspaceMember.findOne({
    _id: req.params.memberId,
    workspace: req.workspaceId,
  });
  if (!member) throw new ApiError(404, "Member not found.");
  const previous = member.role;
  member.role = role;
  await member.save();
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.ROLE_CHANGED,
    targetType: "WorkspaceMember",
    targetId: member._id,
    metadata: { previous, role },
  });
  res.json({ member });
});

export const removeMember = asyncHandler(async (req, res) => {
  const member = await WorkspaceMember.findOne({
    _id: req.params.memberId,
    workspace: req.workspaceId,
  });
  if (!member) throw new ApiError(404, "Member not found.");
  if (String(member.user) === String(req.user._id)) {
    throw new ApiError(400, "You cannot remove yourself.");
  }
  await member.deleteOne();
  await writeAudit({
    workspace: req.workspaceId,
    actor: req.user._id,
    action: AUDIT_ACTIONS.MEMBER_REMOVED,
    targetType: "WorkspaceMember",
    targetId: member._id,
    metadata: {},
  });
  res.json({ ok: true });
});
