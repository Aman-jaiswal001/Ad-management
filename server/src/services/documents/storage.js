import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { env } from "../../config/env.js";

export function uploadRoot() {
  return path.resolve(env.uploadDirectory);
}

export async function ensureUploadDir(...segments) {
  const dir = path.join(uploadRoot(), ...segments);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveBuffer({ workspaceId, folder, originalName, buffer }) {
  const ext = path.extname(originalName || "").slice(0, 12);
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const dir = await ensureUploadDir(String(workspaceId), folder);
  const full = path.join(dir, name);
  await fs.writeFile(full, buffer);
  return path.relative(uploadRoot(), full).replace(/\\/g, "/");
}

export function resolveStored(relativePath) {
  const root = uploadRoot();
  const full = path.resolve(root, relativePath);
  if (!full.startsWith(root)) {
    throw new Error("Invalid storage path.");
  }
  return full;
}

export async function removeStored(relativePath) {
  if (!relativePath) return;
  try {
    await fs.unlink(resolveStored(relativePath));
  } catch {
    /* ignore missing */
  }
}
