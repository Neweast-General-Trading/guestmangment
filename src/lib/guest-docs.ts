import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GUEST_DOC_SLOTS, isGuestDocType, parseGuestDocs, type GuestDoc, type GuestDocType } from "./guest-doc-types";
import { prisma } from "./prisma";

const DIR = path.join(process.cwd(), "data", "guest-docs");
const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function saveGuestDocs(visitId: string, formData: FormData) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { attachmentsJson: true },
  });
  if (!visit) throw new Error("Visit request was not found.");
  const current = parseGuestDocs(visit.attachmentsJson);
  let changed = false;
  for (const slot of GUEST_DOC_SLOTS) {
    const file = formData.get(`doc_${slot.id}`);
    if (!(file instanceof File) || file.size <= 0) continue;
    if (file.size > 8 * 1024 * 1024) throw new Error(`${slot.label} must be under 8 MB.`);
    const ext = path.extname(file.name || "").toLowerCase();
    if (!MIME[ext]) throw new Error(`${slot.label} must be a PDF or an image.`);
    const stored = `${visitId}-${slot.id}${ext}`;
    await mkdir(DIR, { recursive: true });
    await writeFile(path.join(DIR, stored), Buffer.from(await file.arrayBuffer()));
    const next: GuestDoc = { type: slot.id, name: path.basename(file.name || stored), stored };
    const index = current.findIndex((doc) => doc.type === slot.id);
    if (index >= 0) current[index] = next;
    else current.push(next);
    changed = true;
  }
  if (!changed) return current;
  await prisma.visit.update({
    where: { id: visitId },
    data: { attachmentsJson: JSON.stringify(current) },
  });
  return current;
}

export async function readGuestDoc(stored: string, type: GuestDocType) {
  const base = path.basename(stored);
  const ext = path.extname(base).toLowerCase();
  if (base !== stored || !base.endsWith(`-${type}${ext}`) || !MIME[ext]) return null;
  try {
    const bytes = await readFile(path.join(DIR, base));
    return { bytes, type: MIME[ext], name: base };
  } catch {
    return null;
  }
}

export function docOfType(raw: string | null | undefined, type: string) {
  if (!isGuestDocType(type)) return null;
  return parseGuestDocs(raw).find((doc) => doc.type === type) || null;
}
