import { fmtDate, fmtTime } from "./format";
import { sendVisitDigestEmail, visitDigestRecipient } from "./mail";
import { preparationReady } from "./preparation";
import { prisma } from "./prisma";

/**
 * One private email per visit to the system owner (VISIT_DIGEST_TO) once the visit is approved and fully
 * prepared: the whole story of the visit in one place. Nobody else receives it.
 */

const READY_STATUSES = ["APPROVED", "INVITATION_SENT", "EXPECTED"];
const claimKey = (visitId: string) => `visit_digest:${visitId}`;

/** Atomic "first one wins" marker; true only for the run that inserted it. */
async function claim(visitId: string, value: string) {
  const inserted = await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "SystemSetting" ("key", "value") VALUES (?, ?)`,
    claimKey(visitId),
    value,
  );
  return inserted > 0;
}

const digestInclude = {
  createdBy: { select: { name: true, email: true } },
  host: { select: { name: true } },
  department: { select: { name: true } },
  visitors: { include: { visitor: true }, orderBy: { sortOrder: "asc" as const } },
  approvals: { include: { assignee: { select: { name: true } } }, orderBy: { stepOrder: "asc" as const } },
  timeline: { orderBy: { createdAt: "asc" as const } },
  auditLogs: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" as const } },
  notifications: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" as const } },
};

type DigestVisit = NonNullable<Awaited<ReturnType<typeof loadVisit>>>;

function loadVisit(visitId: string) {
  return prisma.visit.findUnique({ where: { id: visitId }, include: digestInclude });
}

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stamp(value: Date) {
  return `${fmtDate(value)} ${fmtTime(value)}`;
}

function statusWord(required: boolean | null | undefined, status: string | null | undefined) {
  if (!required) return "Not needed";
  return status === "DONE" ? "Done" : status ? status.charAt(0) + status.slice(1).toLowerCase() : "Pending";
}

function compactJson(raw: string | null) {
  if (!raw) return "";
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(data)
      .filter(([, value]) => value !== null && value !== "" && typeof value !== "object")
      .map(([key, value]) => `${key}: ${value}`)
      .join(" · ");
  } catch {
    return raw.slice(0, 160);
  }
}

export function isVisitReadyForDigest(visit: Parameters<typeof preparationReady>[0] & { status: string; expectedArrival: Date }) {
  if (!READY_STATUSES.includes(visit.status)) return false;
  if (visit.expectedArrival.getTime() < Date.now() - 24 * 60 * 60 * 1000) return false;
  return preparationReady(visit);
}

export function buildVisitDigest(visit: DigestVisit, userNames: Map<string, string>) {
  const end =
    visit.expectedDeparture && visit.expectedDeparture > visit.expectedArrival
      ? visit.expectedDeparture
      : new Date(visit.expectedArrival.getTime() + 60 * 60 * 1000);
  const title = visit.visitTitle.trim() || visit.purpose;
  const subject = `Visit history · ${visit.visitCode} · ${title} · ${fmtDate(visit.expectedArrival)}`;

  const facts: [string, string][] = [
    ["Reference", visit.visitCode],
    ["Title", title],
    ["When", `${fmtDate(visit.expectedArrival)} · ${fmtTime(visit.expectedArrival)}–${fmtTime(end)}`],
    ["Room", visit.meetingRoom || "—"],
    ["Status", visit.status],
    ["Kind", visit.guestKind || visit.type],
    ["Requested by", visit.createdBy.name],
    ["Host", visit.host.name],
    ["Department", visit.department.name],
    ["Purpose", visit.purpose],
  ];

  const arrangements: [string, string][] = [
    ["Meeting room", visit.calendarInvitedAt ? `Confirmed · invites sent ${stamp(visit.calendarInvitedAt)}` : "Not confirmed"],
    ["Building tour", (visit.tourType || "NONE") === "NONE" ? "None" : `${visit.tourType} · ${visit.tourStatus || "Pending"}`],
    ["Gate pass", statusWord(visit.gatePassRequired || visit.visitors.some((v) => v.gatePassRequired), visit.visitors.some((v) => v.gatePassRequired) ? (visit.visitors.every((v) => !v.gatePassRequired || v.gatePassStatus === "DONE") ? "DONE" : "PENDING") : visit.gatePassStatus)],
    ["Gift", statusWord(visit.giftRequired || visit.visitors.some((v) => v.giftRequired), visit.visitors.some((v) => v.giftRequired) ? (visit.visitors.every((v) => !v.giftRequired || v.giftStatus === "DONE") ? "DONE" : "PENDING") : visit.giftStatus)],
    ["Driver", visit.driverRequired ? `${statusWord(true, visit.driverStatus)}${visit.driverName ? ` · ${visit.driverName}` : ""}` : "Not needed"],
  ];

  const guests = visit.visitors.map((link) => ({
    name: link.visitor.fullName,
    company: link.visitor.company || "",
    contact: [link.visitor.email, link.visitor.mobile].filter(Boolean).join(" · "),
    gatePass: statusWord(link.gatePassRequired, link.gatePassStatus),
    gift: link.giftRequired ? `${link.giftType || "Gift"} · ${statusWord(true, link.giftStatus)}` : "—",
  }));

  const approvals = visit.approvals.map((step) => ({
    step: step.stepName,
    who: step.assignee?.name || step.requiredRole,
    status: step.status,
    when: step.decidedAt ? stamp(step.decidedAt) : "—",
    note: step.comments || "",
  }));

  // One chronological story: timeline events plus audit entries, de-duplicated by time and action.
  const story = [
    ...visit.timeline.map((row) => ({
      at: row.createdAt,
      what: row.event,
      who: row.userId ? userNames.get(row.userId) || "" : "System",
      note: row.note || "",
    })),
    ...visit.auditLogs.map((row) => ({
      at: row.createdAt,
      what: row.action,
      who: row.user?.name || "System",
      note: compactJson(row.newValue),
    })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .filter((row, index, list) => {
      const prev = list[index - 1];
      return !prev || prev.what !== row.what || Math.abs(prev.at.getTime() - row.at.getTime()) > 5_000;
    });

  // Who was told what, collapsed per person.
  const told = new Map<string, Map<string, number>>();
  for (const row of visit.notifications) {
    const person = row.user.name;
    const kinds = told.get(person) || new Map<string, number>();
    kinds.set(row.title, (kinds.get(row.title) || 0) + 1);
    told.set(person, kinds);
  }

  const text = [
    subject,
    "",
    ...facts.map(([k, v]) => `${k}: ${v}`),
    "",
    "Guests:",
    ...guests.map((g) => `- ${g.name}${g.company ? ` (${g.company})` : ""} · gate pass ${g.gatePass} · gift ${g.gift}`),
    "",
    "Arrangements:",
    ...arrangements.map(([k, v]) => `- ${k}: ${v}`),
    "",
    "History:",
    ...story.map((row) => `- ${stamp(row.at)} · ${row.what} · ${row.who}${row.note ? ` · ${row.note}` : ""}`),
  ].join("\n");

  const cell = "padding:8px 10px;border-top:1px solid #e3e8e6;vertical-align:top;font-size:13px;";
  const head = "padding:8px 10px;text-align:left;font-size:11px;letter-spacing:.06em;color:#6b7572;font-weight:700;";
  const section = (label: string, body: string) =>
    `<h2 style="margin:26px 0 8px;font-size:13px;letter-spacing:.08em;color:#6b7572;text-transform:uppercase;">${esc(label)}</h2>${body}`;
  const table = (cols: string[], rows: string[][]) =>
    `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e3e8e6;border-radius:10px;"><tr>${cols
      .map((c) => `<th style="${head}">${esc(c)}</th>`)
      .join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td style="${cell}">${c}</td>`).join("")}</tr>`).join("")}</table>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1b1f1e;">
<div style="max-width:760px;margin:24px auto;padding:0 16px;">
  <div style="background:#1f3b4d;border-radius:12px;padding:20px 24px;color:#fff;">
    <div style="font-size:11px;letter-spacing:.16em;font-weight:700;opacity:.8;">PRIVATE · VISIT HISTORY</div>
    <div style="font-size:22px;font-weight:600;margin-top:6px;">${esc(visit.visitCode)} · ${esc(title)}</div>
    <div style="font-size:14px;margin-top:4px;opacity:.9;">${esc(fmtDate(visit.expectedArrival))} · ${esc(fmtTime(visit.expectedArrival))}–${esc(fmtTime(end))} · ${esc(visit.meetingRoom || "No room")}</div>
  </div>
  ${section("Visit", table(["", ""], facts.map(([k, v]) => [`<span style="color:#6b7572">${esc(k)}</span>`, `<b>${esc(v)}</b>`])))}
  ${section(`Guests (${guests.length})`, table(["Guest", "Company", "Contact", "Gate pass", "Gift"], guests.map((g) => [esc(g.name), esc(g.company), esc(g.contact), esc(g.gatePass), esc(g.gift)])))}
  ${section("Arrangements", table(["", ""], arrangements.map(([k, v]) => [`<span style="color:#6b7572">${esc(k)}</span>`, esc(v)])))}
  ${approvals.length ? section("Approvals", table(["Step", "By", "Decision", "When", "Note"], approvals.map((a) => [esc(a.step), esc(a.who), esc(a.status), esc(a.when), esc(a.note)]))) : ""}
  ${section(`History (${story.length})`, table(["When", "What", "Who", "Details"], story.map((row) => [`<span style="white-space:nowrap">${esc(stamp(row.at))}</span>`, `<b>${esc(row.what)}</b>`, esc(row.who), esc(row.note)])))}
  ${told.size ? section("Who was notified", table(["Person", "Notices"], [...told].map(([person, kinds]) => [esc(person), [...kinds].map(([t, n]) => `${esc(t)}${n > 1 ? ` ×${n}` : ""}`).join("<br>")]))) : ""}
  <p style="font-size:12px;color:#8a9290;margin:18px 0 30px;">Sent only to ${esc(visitDigestRecipient())} by Guest Management, once per visit, when the visit is approved and fully prepared.</p>
</div></body></html>`;

  return { subject, text, html };
}

/** Sends the history once, only when the visit is ready. Safe to call from anywhere, any number of times. */
export async function maybeSendVisitDigest(visitId: string) {
  if (!visitDigestRecipient()) return { sent: false as const };
  const visit = await loadVisit(visitId);
  if (!visit || !isVisitReadyForDigest(visit)) return { sent: false as const };
  if (!(await claim(visitId, new Date().toISOString()))) return { sent: false as const }; // another run has it
  try {
    const ids = [...new Set(visit.timeline.map((row) => row.userId).filter((id): id is string => Boolean(id)))];
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const digest = buildVisitDigest(visit, new Map(users.map((u) => [u.id, u.name])));
    await sendVisitDigestEmail(digest);
    return { sent: true as const };
  } catch (error) {
    await prisma.systemSetting.delete({ where: { key: claimKey(visitId) } }).catch(() => undefined);
    throw error;
  }
}

/** Catches visits that became ready through any path (gift done, driver done, tour approved…). */
export async function sendReadyVisitDigests() {
  if (!visitDigestRecipient()) return;
  const candidates = await prisma.visit.findMany({
    where: {
      status: { in: READY_STATUSES },
      expectedArrival: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
    take: 100,
  });
  if (!candidates.length) return;
  const done = await prisma.systemSetting.findMany({
    where: { key: { in: candidates.map((c) => claimKey(c.id)) } },
    select: { key: true },
  });
  const sent = new Set(done.map((row) => row.key));
  for (const candidate of candidates) {
    if (sent.has(claimKey(candidate.id))) continue;
    await maybeSendVisitDigest(candidate.id).catch(() => undefined);
  }
}

/** Marks every visit that is already ready as handled, so turning the feature on does not mail old visits. */
export async function markReadyVisitsAsSent() {
  const candidates = await prisma.visit.findMany({
    where: { status: { in: READY_STATUSES } },
    include: { visitors: true },
  });
  let marked = 0;
  for (const visit of candidates) {
    if (!preparationReady(visit) && visit.expectedArrival.getTime() >= Date.now()) continue;
    if (await claim(visit.id, "skipped at launch")) marked += 1;
  }
  return marked;
}
