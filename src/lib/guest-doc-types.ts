export const GUEST_DOC_SLOTS = [
  { id: "ID", label: "ID" },
  { id: "PASSPORT", label: "Passport" },
  { id: "VISA", label: "Visa" },
] as const;

export type GuestDocType = (typeof GUEST_DOC_SLOTS)[number]["id"];

export type GuestDoc = {
  type: GuestDocType;
  name: string;
  stored: string;
};

const IDS = new Set<string>(GUEST_DOC_SLOTS.map((slot) => slot.id));

export function isGuestDocType(value: string): value is GuestDocType {
  return IDS.has(value);
}

export function parseGuestDocs(raw?: string | null): GuestDoc[] {
  if (!raw?.trim()) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const docs: GuestDoc[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const type = String((item as GuestDoc).type || "");
      const name = String((item as GuestDoc).name || "").trim();
      const stored = String((item as GuestDoc).stored || "").trim();
      if (!isGuestDocType(type) || !name || !stored) continue;
      docs.push({ type, name, stored });
    }
    return docs;
  } catch {
    return [];
  }
}

export function guestDocHref(visitId: string, type: GuestDocType) {
  return `/api/guest-docs/${visitId}/${type}`;
}
