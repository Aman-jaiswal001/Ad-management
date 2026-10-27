import { AuditLog } from "../models/AuditLog.js";

export async function writeAudit({ workspace, actor, action, targetType, targetId, metadata }) {
  const safeMeta = { ...(metadata || {}) };
  delete safeMeta.password;
  delete safeMeta.passwordHash;
  delete safeMeta.token;
  delete safeMeta.content;
  delete safeMeta.extractedText;
  delete safeMeta.apiKey;
  await AuditLog.create({
    workspace,
    actor,
    action,
    targetType,
    targetId: targetId ? String(targetId) : "",
    metadata: safeMeta,
  });
}
