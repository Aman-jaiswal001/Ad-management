import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env.js";
import fs from "fs/promises";
import path from "path";
import { ApiError } from "../../utils/ApiError.js";

let configured = false;

function cloudinaryClient() {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new ApiError(503, "File storage is not configured. Contact the administrator.");
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export async function saveBuffer({ workspaceId, folder, originalName, buffer, mimeType }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new ApiError(400, "The uploaded file is empty.");
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) cloudinaryClient();
  const client = cloudinaryClient();
  const ext = (originalName?.split(".").pop() || "").toLowerCase();
  const publicId = crypto.randomUUID();
  let result;
  try {
    result = await new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "authenticated",
        access_mode: "authenticated",
        folder: `inkloom-ai/${folder}/${workspaceId}`,
        public_id: publicId,
        overwrite: false,
        context: { original_filename: originalName || "file", mime_type: mimeType || "" },
      },
      (error, uploaded) => (error ? reject(new Error("Cloudinary upload failed", { cause: error })) : resolve(uploaded))
    );
    stream.end(buffer);
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Cloudinary's SDK errors can contain credential or request details. Log only
    // its safe error code/name and return a helpful non-secret message to clients.
    console.error("Cloudinary upload failed:", err?.http_code || err?.name || "Unknown error");
    const detail = String(err?.message || "").toLowerCase();
    if (detail.includes("api_key") || detail.includes("cloud_name") || detail.includes("invalid signature") || detail.includes("unauthorized")) {
      throw new ApiError(503, "Cloudinary rejected the server credentials. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the backend environment, then restart the backend.");
    }
    throw new ApiError(502, "Cloudinary could not store this file. Check the backend connection and Cloudinary account settings, then retry.");
  }
  return {
    publicId: result.public_id,
    resourceType: result.resource_type,
    deliveryType: result.type,
    secureUrl: result.secure_url,
    format: ext,
    bytes: result.bytes,
  };
}

export async function removeStored(publicId, resourceType = "raw", deliveryType = "authenticated") {
  if (!publicId) return;
  const client = cloudinaryClient();
  try {
    const result = await client.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: deliveryType,
      invalidate: true,
    });
    if (!["ok", "not found"].includes(result.result)) {
      throw new ApiError(502, "File storage could not confirm deletion.");
    }
  } catch {
    throw new ApiError(502, "File storage could not delete the file. Please retry.");
  }
}

export async function removeLegacyStored(relativePath) {
  if (!relativePath) return;
  const root = path.resolve("uploads");
  const full = path.resolve(root, relativePath);
  if (!full.startsWith(`${root}${path.sep}`)) return;
  try { await fs.unlink(full); } catch { /* missing or ephemeral legacy file */ }
}

export function getCloudinaryUrl(publicId, resourceType = "raw", deliveryType = "authenticated", format) {
  const client = cloudinaryClient();
  const suffix = format ? `.${format}` : "";
  return client.utils.private_download_url(`${publicId}${suffix}`, format || "", {
    resource_type: resourceType,
    type: deliveryType,
    attachment: true,
  });
}
