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

async function storeDoc(ownerId: string, slot: (typeof GUEST_DOC_SLOTS)[number], file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error(`${slot.label} must be under 8 MB.`);
  const ext = path.extname(file.name || "").toLowerCase();
  if (!MIME[ext]) throw new Error(`${slot.label} must be a PDF or an image.`);
  const stored = `${ownerId}-${slot.id}${ext}`;
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, stored), Buffer.from(await file.arrayBuffer()));
  return { type: slot.id, name: path.basename(file.name || stored), stored } satisfies GuestDoc;
}

export type DocSaveFailure = { guest: string; slot: string; reason: string };

export async function saveGuestDocs(visitId: string, formData: FormData): Promise<DocSaveFailure[]> {
  const links = await prisma.visitVisitor.findMany({
    where: { visitId },
    orderBy: [{ sortOrder: "asc" }, { isPrimary: "desc" }],
    select: { id: true, attachmentsJson: true },
  });
  if (!links.length) throw new Error("Visit request was not found.");
  const postedRows = Number(formData.get("visitorRows") || 0);
  const failures: DocSaveFailure[] = [];
  let linkAt = 0;
  const last = postedRows > 0 ? postedRows : links.length;
  for (let index = 0; index < last; index += 1) {
    const guestName = String(formData.get(`fullName_${index}`) || "").trim();
    if (postedRows > 0 && !guestName) continue;
    const link = links[linkAt];
    linkAt += 1;
    if (!link) break;
    const current = parseGuestDocs(link.attachmentsJson);
    let changed = false;
    for (const slot of GUEST_DOC_SLOTS) {
      const named = formData.get(`doc_${index}_${slot.id}`);
      const legacy = index === 0 ? formData.get(`doc_${slot.id}`) : null;
      const file = named instanceof File && named.size > 0 ? named : legacy instanceof File && legacy.size > 0 ? legacy : null;
      if (!file) continue;
      try {
        const next = await storeDoc(link.id, slot, file);
        const at = current.findIndex((doc) => doc.type === slot.id);
        if (at >= 0) current[at] = next;
        else current.push(next);
        changed = true;
      } catch (error) {
        failures.push({
          guest: guestName || `Guest ${index + 1}`,
          slot: slot.label,
          reason: error instanceof Error ? error.message : "The file was not uploaded.",
        });
      }
    }
    if (!changed) continue;
    await prisma.visitVisitor.update({
      where: { id: link.id },
      data: { attachmentsJson: JSON.stringify(current) },
    });
  }
  return failures;
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
