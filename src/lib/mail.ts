import nodemailer, { type Transporter } from "nodemailer";
import { APP_NAME, HQ_NAME } from "./constants";
import { fmtDate, fmtTime } from "./format";

export type InviteMailVisit = {
  visitCode: string;
  qrToken: string;
  purpose: string;
  visitDate: Date;
  expectedArrival: Date;
  meetingRoom: string | null;
  location: string | null;
  hostName: string;
  departmentName: string;
  visitors: { fullName: string; email: string | null }[];
  instructions?: string;
};

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mailEnabled() {
  return guestMailEnabled() || Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
}

function guestMailEnabled() {
  return Boolean(process.env.GUEST_INBOX_USER?.trim() && process.env.GUEST_INBOX_PASS);
}

let transporter: Transporter | null = null;
let guestTransporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    name: process.env.SMTP_EHLO_NAME || "guest.neweast.cloud",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  return transporter;
}

function getGuestTransporter() {
  if (guestTransporter) return guestTransporter;
  guestTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    name: process.env.SMTP_EHLO_NAME || "guest.neweast.cloud",
    auth: {
      user: process.env.GUEST_INBOX_USER || "",
      pass: process.env.GUEST_INBOX_PASS || "",
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  return guestTransporter;
}

function guestFrom() {
  const box = process.env.GUEST_INBOX_USER?.trim() || "guest@neweast.co";
  return { box, from: `"NEWEAST Guest Management" <${box}>` };
}

export function mailWatchBcc() {
  return (process.env.MAIL_BCC || process.env.MAIL_DELIVER_TO || "sakour@neweast.co").trim().toLowerCase();
}

function tidyEmail(raw: string) {
  const text = String(raw || "").trim();
  const angle = text.match(/<([^>]+@[^>]+)>/);
  const email = (angle?.[1] || text).trim().toLowerCase();
  return email.includes("@") ? email : "";
}

export function mailEnvelope(to: string | string[]) {
  const intended = [...new Set((Array.isArray(to) ? to : [to]).map(tidyEmail).filter(Boolean))];
  const watch = mailWatchBcc();
  return {
    to: intended,
    bcc: watch && !intended.includes(watch) ? watch : "",
  };
}

const mailed = new Set<string>();

async function sendOut(mail: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
}) {
  if (!guestMailEnabled()) {
    throw new Error("Guest mailbox send is not configured.");
  }
  const envelope = mailEnvelope(mail.to);
  if (!envelope.to.length) return;
  const { box, from } = guestFrom();
  const key = `${envelope.to.join(",")}|${mail.subject}|${mail.text || ""}`;
  if (mailed.has(key)) return;
  mailed.add(key);
  await getGuestTransporter().sendMail({
    ...mail,
    from,
    replyTo: box,
    to: envelope.to.join(", "),
    bcc: envelope.bcc || undefined,
    subject: mail.subject,
  });
}

export type ConfirmGuest = { name: string; company?: string | null; jobTitle?: string | null };

function guestLine(guest: ConfirmGuest) {
  return [guest.name, guest.jobTitle, guest.company].filter(Boolean).join(" · ");
}

export async function sendRoomConfirmEmail(input: {
  to: string;
  subject: string;
  date: string;
  start: string;
  end: string;
  room: string;
  guests: ConfirmGuest[];
  guestCount?: number;
  visitCode: string;
  inReplyTo?: string | null;
}) {
  if (!guestMailEnabled()) {
    throw new Error("Guest mailbox send is not configured.");
  }
  const box = process.env.GUEST_INBOX_USER?.trim() || "guest@neweast.co";
  const from = `"NEWEAST Guest Management" <${box}>`;
  const names = input.guests.map(guestLine).filter(Boolean);
  const count = input.guestCount || names.length;
  const party = count === 1 ? "1 guest" : `${count} guests`;
  const hello = "Hello,";
  const intro = "The meeting room is booked and ready. Details for the visit are below.";
  const guestText = names.length ? names.map((name) => `• ${name}`).join("\n") : party;
  const guestHtml = names.length
    ? names
        .map(
          (name, index) =>
            `<tr><td style="padding:12px 16px;${index ? "border-top:1px solid #e3e8e6;" : ""}font-size:14px;font-weight:600;color:#1b1f1e;">${esc(name)}</td></tr>`,
        )
        .join("")
    : `<tr><td style="padding:12px 16px;font-size:14px;font-weight:600;">${esc(party)}</td></tr>`;
  const text = [
    hello,
    "",
    intro,
    "",
    `Date: ${input.date}`,
    `Time: ${input.start} – ${input.end}`,
    `Room: ${input.room}`,
    `Reference: ${input.visitCode}`,
    "",
    "Guests",
    guestText,
    "",
    "This message was sent automatically. Please do not reply.",
  ].join("\n");
  const mail = {
    from,
    replyTo: box,
    to: input.to,
    subject: input.subject,
    text,
    inReplyTo: input.inReplyTo || undefined,
    references: input.inReplyTo || undefined,
    html: `<!DOCTYPE html>
<html><body style="margin:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1b1f1e;">
  <div style="max-width:560px;margin:28px auto;background:#fff;border:1px solid #e3e8e6;border-radius:16px;overflow:hidden;">
    <div style="background:#1f6b5b;padding:22px 28px 20px;">
      <div style="color:#d7efe8;font-size:11px;letter-spacing:0.16em;font-weight:700;">NEWEAST HEADQUARTERS</div>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#fff;font-weight:600;">Your meeting room is ready</h1>
    </div>
    <div style="padding:26px 28px 8px;">
      <p style="margin:0 0 10px;font-size:15px;color:#1b1f1e;">${esc(hello)}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#4b5552;">${esc(intro)}</p>
      <table style="width:100%;border-collapse:collapse;background:#f7faf9;border:1px solid #e3e8e6;border-radius:12px;">
        <tr><td style="padding:12px 16px;color:#6b7572;font-size:13px;width:34%;">Date</td><td style="padding:12px 16px;text-align:right;font-weight:600;font-size:14px;">${esc(input.date)}</td></tr>
        <tr><td style="padding:12px 16px;color:#6b7572;font-size:13px;border-top:1px solid #e3e8e6;">Time</td><td style="padding:12px 16px;text-align:right;font-weight:600;font-size:14px;border-top:1px solid #e3e8e6;">${esc(input.start)} – ${esc(input.end)}</td></tr>
        <tr><td style="padding:12px 16px;color:#6b7572;font-size:13px;border-top:1px solid #e3e8e6;">Room</td><td style="padding:12px 16px;text-align:right;font-weight:600;font-size:14px;border-top:1px solid #e3e8e6;">${esc(input.room)}</td></tr>
        <tr><td style="padding:12px 16px;color:#6b7572;font-size:13px;border-top:1px solid #e3e8e6;">Reference</td><td style="padding:12px 16px;text-align:right;font-weight:600;font-size:14px;border-top:1px solid #e3e8e6;">${esc(input.visitCode)}</td></tr>
      </table>
      <div style="margin:18px 0 0;color:#6b7572;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;">Guests · ${esc(party)}</div>
      <table style="width:100%;margin-top:8px;border-collapse:collapse;background:#f7faf9;border:1px solid #e3e8e6;border-radius:12px;">${guestHtml}</table>
    </div>
    <div style="padding:18px 28px 24px;color:#8a9290;font-size:12px;line-height:1.5;">This message was sent automatically from guest@neweast.co. Please do not reply.</div>
  </div>
</body></html>`,
  };
  await sendOut(mail);
}

export function greetFirstName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] || "there";
}

export function staffRoomHoldMailCopy(input: {
  name: string;
  room: string;
  date: string;
  start: string;
  end: string;
  subject: string;
  description?: string;
  accepted: boolean;
}) {
  const hello = `Hello ${greetFirstName(input.name)},`;
  const when = `${input.date} · ${input.start} – ${input.end}`;
  const note = input.description?.trim() || "";
  if (input.accepted) {
    return {
      subject: `Confirmed · ${input.room} · ${input.date} · ${input.start}–${input.end}`,
      heading: "Your meeting room is confirmed",
      hello,
      intro: `We received the reply from ${input.room}. The booking is now confirmed.`,
      when,
      note,
    };
  }
  return {
    subject: `Not confirmed · ${input.room} · ${input.date} · ${input.start}–${input.end}`,
    heading: "This meeting room could not confirm",
    hello,
    intro: `We received a reply from ${input.room}. The booking was not accepted, so that slot is free again.`,
    when,
    note,
  };
}

export async function sendStaffRoomHoldEmail(input: {
  to: string | string[];
  name: string;
  room: string;
  date: string;
  start: string;
  end: string;
  subject: string;
  description?: string;
  accepted: boolean;
}) {
  if (!guestMailEnabled()) {
    throw new Error("Guest mailbox send is not configured.");
  }
  const copy = staffRoomHoldMailCopy(input);
  const tone = input.accepted ? "#1f6b5b" : "#5c6563";
  const details: Array<[string, string]> = [
    ["Room", input.room],
    ["When", copy.when],
    ["Subject", input.subject],
  ];
  if (copy.note) details.push(["Description", copy.note]);
  const text = [
    copy.hello,
    "",
    copy.intro,
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    input.accepted
      ? "You can treat this as locked in Outlook. If plans change, cancel it from Meeting rooms."
      : "You can book another room or time from Meeting rooms.",
    "",
    "This message was sent automatically. Please do not reply.",
  ].join("\n");
  const rows = details
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:12px 16px;color:#6b7572;font-size:13px;width:34%;vertical-align:top;${index ? "border-top:1px solid #e3e8e6;" : ""}">${esc(label)}</td><td style="padding:12px 16px;text-align:right;font-weight:600;font-size:14px;${index ? "border-top:1px solid #e3e8e6;" : ""}">${esc(value).replaceAll("\n", "<br>")}</td></tr>`,
    )
    .join("");
  await sendOut({
    to: input.to,
    subject: copy.subject,
    text,
    html: `<!DOCTYPE html>
<html><body style="margin:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1b1f1e;">
  <div style="max-width:560px;margin:28px auto;background:#fff;border:1px solid #e3e8e6;border-radius:16px;overflow:hidden;">
    <div style="background:${tone};padding:22px 28px 20px;">
      <div style="color:#d7efe8;font-size:11px;letter-spacing:0.16em;font-weight:700;">NEWEAST HEADQUARTERS</div>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#fff;font-weight:600;">${esc(copy.heading)}</h1>
    </div>
    <div style="padding:26px 28px 8px;">
      <p style="margin:0 0 10px;font-size:15px;color:#1b1f1e;">${esc(copy.hello)}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#4b5552;">${esc(copy.intro)}</p>
      <table style="width:100%;border-collapse:collapse;background:#f7faf9;border:1px solid #e3e8e6;border-radius:12px;">${rows}</table>
      <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#6b7572;">${
        input.accepted
          ? "You can treat this as locked in Outlook. If plans change, cancel it from Meeting rooms."
          : "You can book another room or time from Meeting rooms."
      }</p>
    </div>
    <div style="padding:18px 28px 24px;color:#8a9290;font-size:12px;line-height:1.5;">This message was sent automatically from guest@neweast.co. Please do not reply.</div>
  </div>
</body></html>`,
  });
}

export async function sendVisitInvitationEmail(visit: InviteMailVisit) {
  const emails = visit.visitors.map((item) => item.email?.trim()).filter((item): item is string => Boolean(item));
  if (!emails.length) {
    return { ok: false as const, error: "No visitor email address." };
  }
  if (!mailEnabled()) {
    return { ok: false as const, error: "Invitation email is not configured." };
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://guest.neweast.cloud").replace(/\/$/, "");
  const inviteUrl = `${appUrl}/invite/${visit.qrToken}`;
  const visitorName = visit.visitors[0]?.fullName || "Guest";
  const when = `${fmtDate(visit.visitDate)} · ${fmtTime(visit.expectedArrival)}`;
  const place = (visit.meetingRoom && visit.meetingRoom !== "Yes" ? visit.meetingRoom : null) || visit.location || HQ_NAME;
  const html = `<!DOCTYPE html>
<html><body style="margin:0;background:#f7f4f4;font-family:Arial,sans-serif;color:#16181d;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #ead8d8;border-radius:12px;padding:28px;">
    <div style="color:#b51e21;font-size:11px;letter-spacing:0.16em;font-weight:700;">NEWEAST HEADQUARTERS</div>
    <h1 style="margin:8px 0 0;font-size:22px;">You are invited</h1>
    <p style="color:#5f6672;font-size:14px;">Please present this invitation at the Main Gate.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#8a9099;">Visitor</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(visitorName)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a9099;">Reference</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(visit.visitCode)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a9099;">Date</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(when)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a9099;">Host</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(visit.hostName)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a9099;">Department</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(visit.departmentName)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a9099;">Location</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(place)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a9099;">Purpose</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(visit.purpose)}</td></tr>
    </table>
    <p style="margin:22px 0 0;text-align:center;">
      <a href="${esc(inviteUrl)}" style="display:inline-block;background:#b51e21;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;">Open invitation &amp; QR code</a>
    </p>
    ${visit.instructions ? `<p style="margin-top:18px;color:#5f6672;font-size:13px;">${esc(visit.instructions)}</p>` : ""}
    <p style="margin-top:18px;color:#8a9099;font-size:12px;">${esc(HQ_NAME)}</p>
  </div>
</body></html>`;

  try {
    await sendOut({
      to: emails,
      subject: `Visitor invitation · ${visit.visitCode} · ${HQ_NAME}`,
      text: [
        `You are invited to ${HQ_NAME}.`,
        `Visitor: ${visitorName}`,
        `Reference: ${visit.visitCode}`,
        `Date: ${when}`,
        `Host: ${visit.hostName} · ${visit.departmentName}`,
        `Location: ${place}`,
        `Purpose: ${visit.purpose}`,
        `Invitation: ${inviteUrl}`,
        visit.instructions || "",
      ]
        .filter(Boolean)
        .join("\n"),
      html,
    });
    return { ok: true as const, emails };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unable to send invitation email.",
    };
  }
}

export async function sendServicePrepEmail(input: {
  to: string;
  name: string;
  visitCode: string;
  when: string;
  visitorName: string;
  hostName: string;
  services: Array<{ label: string; notes: string }>;
  url: string;
}) {
  if (!mailEnabled()) {
    return { ok: false as const, error: "Email is not configured." };
  }
  const list = input.services
    .map((item) => `• ${item.label}${item.notes ? ` — ${item.notes}` : ""}`)
    .join("\n");
  const htmlList = input.services
    .map(
      (item) =>
        `<li style="margin:0 0 8px;"><strong>${esc(item.label)}</strong>${item.notes ? `<div style="color:#5f6672;font-size:13px;">${esc(item.notes)}</div>` : ""}</li>`,
    )
    .join("");

  try {
    await sendOut({
      to: input.to,
      subject: `Prepare guest services · ${input.visitCode} · ${HQ_NAME}`,
      text: [
        `Hello ${input.name},`,
        `A visit was approved. Please prepare the service(s) assigned to you.`,
        `Visitor: ${input.visitorName}`,
        `Reference: ${input.visitCode}`,
        `Date: ${input.when}`,
        `Host: ${input.hostName}`,
        list,
        `Update status: ${input.url}`,
      ].join("\n"),
      html: `<!DOCTYPE html>
<html><body style="margin:0;background:#f7f4f4;font-family:Arial,sans-serif;color:#16181d;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #ead8d8;border-radius:12px;padding:28px;">
    <div style="color:#b51e21;font-size:11px;letter-spacing:0.16em;font-weight:700;">NEWEAST HEADQUARTERS</div>
    <h1 style="margin:8px 0 0;font-size:22px;">Guest services to prepare</h1>
    <p style="color:#5f6672;font-size:14px;">Hello ${esc(input.name)}, a visit was approved. Please prepare the service(s) assigned to you.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#8a9099;">Visitor</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(input.visitorName)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a9099;">Reference</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(input.visitCode)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a9099;">Date</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(input.when)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a9099;">Host</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(input.hostName)}</td></tr>
    </table>
    <ul style="margin:16px 0 0;padding-left:18px;font-size:14px;">${htmlList}</ul>
    <p style="margin:22px 0 0;text-align:center;">
      <a href="${esc(input.url)}" style="display:inline-block;background:#b51e21;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;">Open service tasks</a>
    </p>
    <p style="margin-top:18px;color:#8a9099;font-size:12px;">${esc(HQ_NAME)}</p>
  </div>
</body></html>`,
    });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Unable to send service email." };
  }
}

export async function sendNoticeEmail(input: {
  to: string;
  title: string;
  message: string;
  onBehalfOf?: string;
  url?: string;
  cta?: string;
}) {
  if (!mailEnabled()) {
    return { ok: false as const, error: "Email is not configured." };
  }
  const who = input.onBehalfOf || "Guest Management";
  const cta = input.cta || "Open";
  const button = input.url
    ? `<p style="margin:22px 0 0;text-align:center;">
      <a href="${esc(input.url)}" style="display:inline-block;background:#b51e21;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;">${esc(cta)}</a>
    </p>
    <p style="margin-top:12px;color:#8a9099;font-size:12px;word-break:break-all;">${esc(input.url)}</p>`
    : "";
  try {
    await sendOut({
      to: input.to,
      subject: `${input.title} · ${who} · ${HQ_NAME}`,
      text: [`Assigned to: ${who}`, input.message, input.url ? `${cta}: ${input.url}` : ""].filter(Boolean).join("\n\n"),
      html: `<!DOCTYPE html>
<html><body style="margin:0;background:#f7f4f4;font-family:Arial,sans-serif;color:#16181d;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #ead8d8;border-radius:12px;padding:28px;">
    <div style="color:#b51e21;font-size:11px;letter-spacing:0.16em;font-weight:700;">NEWEAST HEADQUARTERS</div>
    <h1 style="margin:8px 0 0;font-size:20px;">${esc(input.title)}</h1>
    <p style="color:#5f6672;font-size:14px;">Assigned to <strong>${esc(who)}</strong></p>
    <p style="font-size:14px;white-space:pre-line;">${esc(input.message)}</p>
    ${button}
  </div>
</body></html>`,
    });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Unable to send notice." };
  }
}
