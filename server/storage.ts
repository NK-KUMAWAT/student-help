// Local disk storage. Files are saved to ./uploads and served at /uploads/:key.
// storageGetSignedUrl returns a public URL (using PUBLIC_BASE_URL) that an LLM
// provider can fetch. In local dev set PUBLIC_BASE_URL to a tunnel URL if you
// need the LLM to read uploaded resumes.

import fs from "fs";
import path from "path";
import { ENV } from "./env";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  ensureUploadDir();
  const key = appendHashSuffix(normalizeKey(relKey));
  const filePath = path.resolve(UPLOAD_DIR, key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data as Buffer);
  return { key, url: `/uploads/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  // If a public base URL is configured, the LLM can fetch the file directly.
  if (ENV.publicBaseUrl) return `${ENV.publicBaseUrl}/uploads/${key}`;
  // Fallback: relative URL (only useful when the LLM runs in the same network).
  return `/uploads/${key}`;
}

export { UPLOAD_DIR };
