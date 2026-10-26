export const GIFT_OWNER_EMAIL = (process.env.GIFT_OWNER_EMAIL || "jesman@neweast.co").trim().toLowerCase();
export const GATE_PASS_OWNER_EMAIL = (process.env.GATE_PASS_OWNER_EMAIL || "navami.balachandran@neweast.co").trim().toLowerCase();

export const GIFT_TYPES = [
  "Welcome gift",
  "NEWEAST welcome pack",
  "Corporate gift bag",
  "Date box",
  "Flower arrangement",
  "Trophy / plaque",
  "Other",
] as const;

export const ARRANGEMENT_LABEL: Record<string, string> = {
  PENDING: "Waiting",
  PREPARING: "Preparing",
  DONE: "Done",
};

export function arrangementHint(visit: {
  driverRequired: boolean;
  driverStatus?: string | null;
  giftRequired: boolean;
  giftType?: string | null;
  giftStatus?: string | null;
  gatePassRequired?: boolean;
  gatePassStatus?: string | null;
}) {
  const parts: string[] = [];
  if (visit.driverRequired) {
    parts.push(`Driver · ${ARRANGEMENT_LABEL[visit.driverStatus || "PENDING"] || visit.driverStatus}`);
  }
  if (visit.giftRequired) {
    const gift = visit.giftType || "Gift";
    parts.push(`${gift} · ${ARRANGEMENT_LABEL[visit.giftStatus || "PENDING"] || visit.giftStatus}`);
  }
  if (visit.gatePassRequired) {
    parts.push(`Gate pass · ${ARRANGEMENT_LABEL[visit.gatePassStatus || "PENDING"] || visit.gatePassStatus}`);
  }
  return parts.join("  ·  ");
}
