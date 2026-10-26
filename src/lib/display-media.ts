import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const DIRS = [
  path.join(process.cwd(), "data", "displays"),
  path.join(process.cwd(), "public", "uploads", "displays"),
];

const EXTS = [".jpg", ".jpeg", ".png", ".webp", ".svg"] as const;
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function extFor(type: string) {
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/svg+xml") return ".svg";
  return ".jpg";
}

export function safeMediaStem(value: string) {
  const stem = value.replace(/\.(jpe?g|png|webp|svg)$/i, "");
  return /^[a-zA-Z0-9_-]+$/.test(stem) ? stem : "";
}

export function resolveDisplayMedia(stem: string) {
  const id = safeMediaStem(stem);
  if (!id) return null;
  for (const dir of DIRS) {
    for (const ext of EXTS) {
      const file = path.join(dir, `${id}${ext}`);
      if (existsSync(file)) return { file, type: TYPES[ext] };
    }
  }
  return null;
}

export async function saveUploadedDisplayImage(file: File) {
  if (!file.size) throw new Error("Add a photo for the screen.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Keep the photo under 20 MB.");
  if (!file.type.startsWith("image/")) throw new Error("Use a JPG, PNG or WebP photo.");
  const dir = DIRS[0];
  await mkdir(dir, { recursive: true });
  const stem = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const ext = extFor(file.type);
  await writeFile(path.join(dir, `${stem}${ext}`), Buffer.from(await file.arrayBuffer()));
  return `/api/display/media/${stem}`;
}

export async function importDisplayFile(from: string, stem: string) {
  const { copyFile } = await import("node:fs/promises");
  const dir = DIRS[0];
  await mkdir(dir, { recursive: true });
  const ext = path.extname(from).toLowerCase() || ".jpg";
  const dest = path.join(dir, `${stem}${ext}`);
  if (!existsSync(dest) && existsSync(from)) await copyFile(from, dest);
  return `/api/display/media/${stem}`;
}
