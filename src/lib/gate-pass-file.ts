import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "data", "gate-passes");
const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function saveGatePassFile(visitId: string, file?: File | null) {
  if (!file || file.size <= 0) throw new Error("Upload the gate pass file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("The gate pass file must be under 8 MB.");
  const ext = path.extname(file.name || "").toLowerCase();
  if (!TYPES[ext]) throw new Error("Upload a PDF or image.");
  const name = `${visitId}${ext}`;
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, name), Buffer.from(await file.arrayBuffer()));
  return { name, type: TYPES[ext] };
}

export async function readGatePassFile(name: string) {
  const base = path.basename(name);
  const ext = path.extname(base).toLowerCase();
  if (base !== name || !TYPES[ext]) return null;
  try {
    const bytes = await readFile(path.join(DIR, base));
    return { bytes, type: TYPES[ext], name: base };
  } catch {
    return null;
  }
}
