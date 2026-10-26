import { GUEST_KINDS, type GuestKind } from "./constants";

export const TEMPLATE_BEGIN = "---BEGIN GUEST-REQUEST-v1---";
export const TEMPLATE_END = "---END GUEST-REQUEST-v1---";

export type ParsedVisitor = {
  fullName: string;
  mobile: string;
  email: string;
  company: string;
  jobTitle: string;
  nationality: string;
};

export type ParsedGuestRequest = {
  visitDate: string;
  arrivalTime: string;
  department: string;
  guestKind: GuestKind;
  visitorCount: number;
  driverRequired: boolean;
  purpose: string;
  visitors: ParsedVisitor[];
};

export function guestRequestTemplate(sample?: Partial<ParsedGuestRequest>) {
  const date = sample?.visitDate || "YYYY-MM-DD";
  const time = sample?.arrivalTime || "HH:MM";
  const visitors = sample?.visitors?.length ? sample.visitors : [emptyVisitor()];
  const body = visitors
    .map(
      (visitor, index) =>
        `Visitor ${index + 1}
Full name: ${visitor.fullName}
Mobile: ${visitor.mobile}
Email: ${visitor.email}
Company: ${visitor.company}
Job title: ${visitor.jobTitle}
Nationality: ${visitor.nationality}`,
    )
    .join("\n\n");

  return `NEWEAST Headquarters — Guest visit request

Fill every line. Keep the BEGIN / END markers. Send to guest@neweast.co.

${TEMPLATE_BEGIN}
Visit date: ${date}
Arrival time: ${time}
Department: ${sample?.department || ""}
Guest type: ${sample?.guestKind || "VIP | Supplier | Customer | Guest"}
Number of visitors: ${sample?.visitorCount || visitors.length || 1}
Driver required: ${sample?.driverRequired ? "Yes" : "No"}
Purpose: ${sample?.purpose || ""}

${body}
${TEMPLATE_END}
`;
}

export function emptyVisitor(): ParsedVisitor {
  return { fullName: "", mobile: "", email: "", company: "", jobTitle: "", nationality: "" };
}

export function hasGuestTemplate(text: string) {
  return text.includes(TEMPLATE_BEGIN) && text.includes(TEMPLATE_END);
}

export function templateBlock(text: string) {
  const start = text.indexOf(TEMPLATE_BEGIN);
  const end = text.indexOf(TEMPLATE_END);
  if (start < 0 || end < 0 || end <= start) return "";
  return text.slice(start + TEMPLATE_BEGIN.length, end).trim();
}

function lineValue(block: string, label: string) {
  const match = block.match(new RegExp(`^${label}:\\s*(.*)$`, "im"));
  return (match?.[1] || "").replace(/\s+/g, " ").trim();
}

export function normalizeGuestKind(value: string): GuestKind {
  const raw = value.toLowerCase();
  if (raw.includes("vip") || raw.includes("executive")) return "VIP";
  if (raw.includes("supplier") || raw.includes("vendor")) return "SUPPLIER";
  if (raw.includes("customer") || raw.includes("client")) return "CUSTOMER";
  return "GUEST";
}

export function parseYesNo(value: string) {
  return /^(y|yes|true|1|required|need)/i.test(value.trim());
}

export function parseVisitDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const eu = value.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (eu) return `${eu[3]}-${eu[2].padStart(2, "0")}-${eu[1].padStart(2, "0")}`;
  return "";
}

export function parseArrivalTime(value: string) {
  const mer = value.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (mer) {
    let hour = Number(mer[1]) % 12;
    if (mer[3].toLowerCase() === "pm") hour += 12;
    return `${String(hour).padStart(2, "0")}:${mer[2]}`;
  }
  const hm = value.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return `${hm[1].padStart(2, "0")}:${hm[2]}`;
  return "";
}

function parseVisitors(block: string): ParsedVisitor[] {
  const chunks = block.split(/Visitor\s+\d+/i).slice(1);
  const visitors = chunks.map((chunk) => ({
    fullName: lineValue(chunk, "Full name"),
    mobile: lineValue(chunk, "Mobile"),
    email: lineValue(chunk, "Email"),
    company: lineValue(chunk, "Company"),
    jobTitle: lineValue(chunk, "Job title"),
    nationality: lineValue(chunk, "Nationality"),
  }));
  return visitors.filter((visitor) => visitor.fullName || visitor.mobile || visitor.email);
}

export function parseGuestTemplate(text: string): ParsedGuestRequest | null {
  if (!hasGuestTemplate(text)) return null;
  const block = templateBlock(text);
  if (!block) return null;
  const visitors = parseVisitors(block);
  const count = Number(lineValue(block, "Number of visitors")) || visitors.length || 1;
  return {
    visitDate: parseVisitDate(lineValue(block, "Visit date")),
    arrivalTime: parseArrivalTime(lineValue(block, "Arrival time")),
    department: lineValue(block, "Department"),
    guestKind: normalizeGuestKind(lineValue(block, "Guest type")),
    visitorCount: count,
    driverRequired: parseYesNo(lineValue(block, "Driver required")),
    purpose: lineValue(block, "Purpose"),
    visitors,
  };
}

export function visitTypeFromKind(kind: GuestKind) {
  if (kind === "CUSTOMER") return "CUSTOMER";
  if (kind === "VIP") return "VIP";
  if (kind === "SUPPLIER") return "SUPPLIER";
  return "GUEST";
}

export function isKnownGuestKind(value: string): value is GuestKind {
  return GUEST_KINDS.some((item) => item.code === value);
}
