import {
  emptyVisitor,
  hasGuestTemplate,
  normalizeGuestKind,
  parseArrivalTime,
  parseGuestTemplate,
  parseVisitDate,
  parseYesNo,
  type ParsedGuestRequest,
  type ParsedVisitor,
} from "./email-template";
import { parseXlsxGuestRequest } from "./xlsx-template";

function decodeQuotedPrintable(text: string) {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

export function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function emailBodyText(raw: string) {
  const decoded = decodeQuotedPrintable(raw);
  const plain = decoded.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--[^\n]*|$)/i);
  if (plain?.[1]?.trim()) return plain[1].trim();
  const html = decoded.match(/Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--[^\n]*|$)/i);
  if (html?.[1]) return stripHtml(html[1]);
  return stripHtml(decoded);
}

function mergeVisitor(base: ParsedVisitor, extra?: Partial<ParsedVisitor>): ParsedVisitor {
  return {
    fullName: base.fullName || extra?.fullName || "",
    mobile: base.mobile || extra?.mobile || "",
    email: base.email || extra?.email || "",
    company: base.company || extra?.company || "",
    jobTitle: base.jobTitle || extra?.jobTitle || "",
    nationality: base.nationality || extra?.nationality || "",
  };
}

function mergeRequest(base: ParsedGuestRequest, extra?: Partial<ParsedGuestRequest>): ParsedGuestRequest {
  const extras = extra?.visitors ?? [];
  const count = Math.max(base.visitorCount, extra?.visitorCount || 0, base.visitors.length, extras.length, 1);
  const visitors = Array.from({ length: count }, (_, index) =>
    mergeVisitor(base.visitors[index] || emptyVisitor(), extras[index]),
  );
  return {
    visitDate: base.visitDate || parseVisitDate(extra?.visitDate || "") || extra?.visitDate || "",
    arrivalTime: base.arrivalTime || parseArrivalTime(extra?.arrivalTime || "") || extra?.arrivalTime || "",
    department: base.department || extra?.department || "",
    guestKind: base.guestKind || (extra?.guestKind ? normalizeGuestKind(extra.guestKind) : "GUEST"),
    visitorCount: count,
    driverRequired: base.driverRequired || Boolean(extra?.driverRequired),
    purpose: base.purpose || extra?.purpose || "",
    visitors: visitors.filter((visitor) => visitor.fullName || visitor.mobile),
  };
}

async function extractWithAi(text: string): Promise<Partial<ParsedGuestRequest> | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 800,
      system:
        "Extract a NEWEAST guest visit request. Reply with JSON only: visitDate (YYYY-MM-DD), arrivalTime (HH:MM), department, guestKind (VIP|SUPPLIER|CUSTOMER|GUEST), visitorCount, driverRequired (boolean), purpose, visitors[{fullName,mobile,email,company,jobTitle,nationality}]. Empty string if unknown.",
      messages: [{ role: "user", content: text.slice(0, 12_000) }],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const textOut = data.content?.find((part) => part.type === "text")?.text || "";
  const json = textOut.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<ParsedGuestRequest>;
    if (parsed.guestKind) parsed.guestKind = normalizeGuestKind(String(parsed.guestKind));
    if (typeof parsed.driverRequired === "string") parsed.driverRequired = parseYesNo(String(parsed.driverRequired));
    return parsed;
  } catch {
    return null;
  }
}

export type ExtractFile = { name: string; bytes: Buffer };

export async function extractGuestRequest(
  text: string,
  files: ExtractFile[] = [],
): Promise<ParsedGuestRequest | null> {
  for (const file of files) {
    if (!/\.xlsx$/i.test(file.name)) continue;
    try {
      const fromExcel = parseXlsxGuestRequest(file.bytes);
      if (fromExcel) {
        const missing = !fromExcel.purpose || !fromExcel.visitDate || !fromExcel.arrivalTime;
        if (!missing) return fromExcel;
        const ai = text.trim() ? await extractWithAi(text).catch(() => null) : null;
        return mergeRequest(fromExcel, ai || undefined);
      }
    } catch {
      // next file
    }
  }
  if (!hasGuestTemplate(text)) return null;
  const fromTemplate = parseGuestTemplate(text);
  if (!fromTemplate) return null;
  const missing =
    !fromTemplate.visitDate ||
    !fromTemplate.arrivalTime ||
    !fromTemplate.department ||
    !fromTemplate.purpose ||
    fromTemplate.visitors.some((visitor) => !visitor.fullName || !visitor.mobile);
  if (!missing) return fromTemplate;
  try {
    const ai = await extractWithAi(text);
    return mergeRequest(fromTemplate, ai || undefined);
  } catch {
    return fromTemplate;
  }
}
