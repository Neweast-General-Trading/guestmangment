import { prisma } from "./prisma";
import { sendNoticeEmail } from "./mail";
import { noticeCta, noticeUrl, withNoticeLink } from "./notice-copy";
import { sendTeamsNotice } from "./teams";
import { emailsNotice } from "./notice-routing";

const sentOutbound = new Set<string>();

function noticeInbox() {
  return process.env.NOTIFY_INBOX?.trim().toLowerCase() || "";
}

export function outboundRecipient(actorEmail?: string | null) {
  return (actorEmail || "").trim();
}

function outboundKey(input: { userId: string; type: string; visitId?: string | null; title: string; message: string }) {
  return `${input.userId}|${input.type}|${input.visitId || ""}|${input.title}|${input.message}`;
}

export async function notify(input: {
  userId: string;
  visitId?: string | null;
  type: string;
  title: string;
  message: string;
  channel?: string;
  onBehalfOf?: string;
}) {
  // Asked before this notice is stored: has this person already had this kind of notice for this visit?
  const seenBefore = input.visitId
    ? (await prisma.notification.count({
        where: { userId: input.userId, visitId: input.visitId, type: input.type },
      })) > 0
    : false;

  await prisma.notification.create({
    data: {
      userId: input.userId,
      visitId: input.visitId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      channel: input.channel ?? "IN_APP",
    },
  });

  const inbox = noticeInbox();
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  const actor = users.find((user) => user.id === input.userId);
  const who = input.onBehalfOf || actor?.name;

  if (inbox) {
    const inboxUser = users.find((user) => user.email.toLowerCase() === inbox);
    if (inboxUser && inboxUser.id !== input.userId) {
      await prisma.notification.create({
        data: {
          userId: inboxUser.id,
          visitId: input.visitId ?? null,
          type: input.type,
          title: input.title,
          message: input.message,
          channel: "IN_APP",
        },
      });
    }
  }

  const key = outboundKey({ ...input, userId: input.userId });
  if (sentOutbound.has(key)) return;
  sentOutbound.add(key);

  const url = noticeUrl(input.type, input.visitId);
  const cta = noticeCta(input.type);
  const outbound = withNoticeLink(input.message, url, cta);
  const to = outboundRecipient(actor?.email);

  // Teams carries every notice in full.
  const teams = await sendTeamsNotice({
    title: input.title,
    message: outbound,
    onBehalfOf: who,
    mailId: to,
    name: actor?.name || who,
    type: input.type,
  }).catch(() => ({ ok: false as const }));

  // Email: essentials only, once per person/visit/kind. Anything Teams could not deliver falls back to email.
  const wantsEmail = emailsNotice(input.type) || !teams.ok;
  if (to && wantsEmail && !seenBefore) {
    await sendNoticeEmail({
      to,
      title: input.title,
      message: input.message,
      onBehalfOf: who,
      url,
      cta,
    });
  }
}

export async function notifyRole(role: string, input: Omit<Parameters<typeof notify>[0], "userId">) {
  const users = await prisma.user.findMany({
    where: { role, isActive: true },
    select: { id: true, name: true },
  });
  await Promise.all(users.map((user) => notify({ ...input, userId: user.id, onBehalfOf: input.onBehalfOf || user.name })));
}

export async function notifyRoles(
  roles: string[],
  input: Omit<Parameters<typeof notify>[0], "userId">,
) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true },
    select: { id: true, name: true },
  });
  await Promise.all(users.map((user) => notify({ ...input, userId: user.id, onBehalfOf: input.onBehalfOf || user.name })));
}
