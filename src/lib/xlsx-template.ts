import { unzipTextFiles } from "./xlsx-zip";
import {
  emptyVisitor,
  normalizeGuestKind,
  parseArrivalTime,
  parseVisitDate,
  parseYesNo,
  type ParsedGuestRequest,
  type ParsedVisitor,
} from "./email-template";

const SAMPLE_NAME = /^lina haddad$/i;
const SAMPLE_MOBILE = /0501234567/;
const PLACEHOLDER = /^(yyyy-mm-dd|hh:mm|guest|no|yes|vip\s*\||at least 8|payroll department)/i;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function decodeXml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function splitRef(ref: string) {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: match[1], row: Number(match[2]) };
}

function nextCol(col: string) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  n += 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function excelSerialToDate(serial: number) {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return "";
  const utc = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  const date = new Date(utc);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function excelSerialToTime(serial: number) {
  if (!Number.isFinite(serial)) return "";
  const portion = serial < 1 ? serial : serial % 1;
  if (portion <= 0) return "";
  const minutes = Math.round(portion * 24 * 60);
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}

function sharedStrings(xml: string) {
  const items: string[] = [];
  const blocks = xml.match(/<si\b[\s\S]*?<\/si>/g) || [];
  for (const block of blocks) {
    const parts = [...block.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]));
    items.push(parts.join(""));
  }
  return items;
}

export function sheetCells(sheetXml: string, strings: string[] = []) {
  const cells = new Map<string, string>();
  const tags = sheetXml.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || [];
  for (const tag of tags) {
    const ref = tag.match(/\br="([A-Z]+\d+)"/)?.[1];
    if (!ref) continue;
    const type = tag.match(/\bt="([^"]+)"/)?.[1] || "";
    let value = "";
    if (type === "s") {
      const index = tag.match(/<v>(\d+)<\/v>/)?.[1];
      value = index ? strings[Number(index)] || "" : "";
    } else if (type === "inlineStr" || type === "str") {
      const text = [...tag.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("");
      value = decodeXml(text);
    } else {
      const raw = tag.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      value = decodeXml(raw);
    }
    if (value) cells.set(ref, value);
  }
  return cells;
}

function cellValue(cells: Map<string, string>, col: string, row: number) {
  return (cells.get(`${col}${row}`) || "").trim();
}

function rightOf(cells: Map<string, string>, ref: string) {
  const parsed = splitRef(ref);
  if (!parsed) return "";
  return cellValue(cells, nextCol(parsed.col), parsed.row);
}

function labeledValue(cells: Map<string, string>, label: string) {
  const needle = label.toLowerCase();
  for (const [ref, value] of cells) {
    if (value.trim().toLowerCase() === needle) return rightOf(cells, ref).trim();
  }
  return "";
}

function asDate(value: string) {
  const iso = parseVisitDate(value);
  if (iso) return iso;
  if (/^\d+(\.\d+)?$/.test(value)) return excelSerialToDate(Number(value));
  return "";
}

function asTime(value: string) {
  const parsed = parseArrivalTime(value);
  if (parsed) return parsed;
  if (/^\d+(\.\d+)?$/.test(value)) return excelSerialToTime(Number(value));
  return "";
}

function asMobile(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  if (/^\d{9}$/.test(digits) && digits.startsWith("5")) return `0${digits}`;
  return digits || value.trim();
}

function isSampleVisitor(visitor: ParsedVisitor) {
  return SAMPLE_NAME.test(visitor.fullName) && SAMPLE_MOBILE.test(visitor.mobile);
}

function isPlaceholder(value: string) {
  return !value.trim() || PLACEHOLDER.test(value.trim());
}

function visitorsFrom(cells: Map<string, string>): ParsedVisitor[] {
  let headerRow = 0;
  for (const [ref, value] of cells) {
    if (value.trim().toLowerCase() !== "full name") continue;
    const parsed = splitRef(ref);
    if (parsed) headerRow = parsed.row;
  }
  if (!headerRow) return [];
  const rows: ParsedVisitor[] = [];
  for (let row = headerRow + 1; row <= headerRow + 12; row += 1) {
    const fullName = cellValue(cells, "A", row);
    if (!fullName || /^visitor\s+\d+$/i.test(fullName) || /email block/i.test(fullName)) break;
    const visitor = {
      fullName,
      mobile: asMobile(cellValue(cells, "B", row)),
      email: cellValue(cells, "C", row),
      company: cellValue(cells, "D", row),
      jobTitle: cellValue(cells, "E", row),
      nationality: cellValue(cells, "F", row),
    };
    if (isSampleVisitor(visitor)) continue;
    rows.push(visitor);
  }
  return rows;
}

export function requestFromCells(cells: Map<string, string>): ParsedGuestRequest | null {
  const visitDate = asDate(labeledValue(cells, "Visit date"));
  const arrivalTime = asTime(labeledValue(cells, "Arrival time"));
  const department = labeledValue(cells, "Department");
  const guestKindRaw = labeledValue(cells, "Guest type");
  const purpose = labeledValue(cells, "Purpose");
  const visitors = visitorsFrom(cells);
  if (!visitors.length && isPlaceholder(department) && !visitDate) return null;
  if (!visitors.length) return null;
  return {
    visitDate,
    arrivalTime,
    department: isPlaceholder(department) ? "" : department,
    guestKind: normalizeGuestKind(isPlaceholder(guestKindRaw) ? "GUEST" : guestKindRaw),
    visitorCount: visitors.length,
    driverRequired: parseYesNo(labeledValue(cells, "Driver required")),
    purpose: isPlaceholder(purpose) ? "" : purpose,
    visitors,
  };
}

export function parseXlsxGuestRequest(buf: Buffer): ParsedGuestRequest | null {
  const files = unzipTextFiles(buf);
  const sheet =
    files.get("xl/worksheets/sheet1.xml") ||
    [...files.entries()].find(([name]) => name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml"))?.[1];
  if (!sheet) return null;
  const strings = files.get("xl/sharedStrings.xml") ? sharedStrings(files.get("xl/sharedStrings.xml") as string) : [];
  return requestFromCells(sheetCells(sheet, strings));
}

export function emptyRequest(): ParsedGuestRequest {
  return {
    visitDate: "",
    arrivalTime: "",
    department: "",
    guestKind: "GUEST",
    visitorCount: 1,
    driverRequired: false,
    purpose: "",
    visitors: [emptyVisitor()],
  };
}
