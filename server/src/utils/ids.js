import crypto from "crypto";

export function findingPublicId() {
  return `FND-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}
