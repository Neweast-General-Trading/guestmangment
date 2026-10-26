import { ImapFlow } from "imapflow";
import { emailBodyText } from "./extract-visit";
import {
  graphConfigured,
  hydrateInboxMessage,
  isDummyMail,
  isRoomReplyMail,
  listAllInboxHeads,
  splitInboxHeads,
  type InboxHead,
} from "./graph";
import { ingestEmailText } from "./intake";
import { prisma } from "./prisma";
import { flushRoomConfirmReplies } from "./room-booking";
import type { SessionUser } from "./permissions";

export type InboxSyncResult = {
  ok: boolean;
  reason?: string;
  scanned: number;
  created: number;
  skipped: number;
  replies: number;
};

function envelopeAddress(value?: { address?: string }[] | null) {
  return value?.[0]?.address || "";
}

async function ingestOne(
  actor: SessionUser,
  input: { text: string; messageId: string; subject: string; from: string; files?: { name: string; bytes: Buffer }[] },
) {
  const already = await prisma.visit.findUnique({
    where: { emailMessageId: input.messageId },
    select: { id: true },
  });
  if (already) return "skipped" as const;
  try {
    const result = await ingestEmailText(actor, input);
    return result.created ? ("created" as const) : ("skipped" as const);
  } catch {
    return "skipped" as const;
  }
}

async function syncViaGraph(actor: SessionUser): Promise<InboxSyncResult> {
  const heads = await listAllInboxHeads();
  const known = new Set(
    (
      await prisma.visit.findMany({
        where: { emailMessageId: { in: heads.map((head) => head.internetMessageId) } },
        select: { emailMessageId: true },
      })
    )
      .map((row) => row.emailMessageId)
      .filter(Boolean),
  );
  let created = 0;
  let skipped = 0;
  let replies = 0;
  const work: InboxHead[] = [];
  for (const head of heads) {
    if (known.has(head.internetMessageId)) {
      skipped += 1;
      continue;
    }
    if (isRoomReplyMail(head.from, head.subject)) {
      replies += 1;
      continue;
    }
    work.push(head);
  }
  for (let i = 0; i < work.length; i += 4) {
    const chunk = await Promise.all(
      work.slice(i, i + 4).map(async (head) => ({ head, full: await hydrateInboxMessage(head.id) })),
    );
    for (const item of chunk) {
      const result = await ingestOne(actor, {
        text: item.full.text,
        messageId: item.head.internetMessageId,
        subject: item.head.subject,
        from: item.head.from,
        files: item.full.files,
      });
      if (result === "created") created += 1;
      else skipped += 1;
    }
  }
  await flushRoomConfirmReplies(heads).catch(() => undefined);
  return { ok: true, scanned: heads.length, created, skipped, replies };
}

async function syncViaImap(actor: SessionUser): Promise<InboxSyncResult> {
  const user = process.env.GUEST_INBOX_USER?.trim();
  const pass = process.env.GUEST_INBOX_PASS;
  if (!user || !pass) {
    return { ok: false, reason: "Guest inbox is not configured.", scanned: 0, created: 0, skipped: 0, replies: 0 };
  }

  const client = new ImapFlow({
    host: process.env.GUEST_INBOX_HOST?.trim() || "outlook.office365.com",
    port: Number(process.env.GUEST_INBOX_PORT || 993),
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  let scanned = 0;
  let created = 0;
  let skipped = 0;
  let replies = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const box = client.mailbox;
      const exists = typeof box === "object" && box ? Number(box.exists) : 0;
      if (!exists) return { ok: true, scanned: 0, created: 0, skipped: 0, replies: 0 };
      const start = Math.max(1, exists - 199);
      for await (const message of client.fetch(`${start}:${exists}`, { envelope: true, source: true, uid: true })) {
        scanned += 1;
        const subject = message.envelope?.subject || "";
        const from = envelopeAddress(message.envelope?.from);
        if (isRoomReplyMail(from, subject)) {
          replies += 1;
          continue;
        }
        const raw = message.source?.toString("utf8") || "";
        const result = await ingestOne(actor, {
          text: emailBodyText(raw),
          messageId: message.envelope?.messageId || `imap-${message.uid}`,
          subject,
          from,
        });
        if (result === "created") created += 1;
        else skipped += 1;
      }
    } finally {
      lock.release();
    }
    await client.logout();
    await flushRoomConfirmReplies().catch(() => undefined);
    return { ok: true, scanned, created, skipped, replies };
  } catch {
    return { ok: false, reason: "Could not read the guest mailbox.", scanned, created, skipped, replies };
  }
}

export async function peekInbox() {
  if (!graphConfigured()) return { requests: [] as InboxHead[], rooms: [] as InboxHead[] };
  const split = splitInboxHeads(await listAllInboxHeads());
  const live = (item: InboxHead) => !isDummyMail(item.subject, item.from);
  return {
    requests: split.requests.filter(live).sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || "")),
    rooms: split.rooms.filter(live).sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || "")),
  };
}

export async function syncGuestInbox(actor: SessionUser): Promise<InboxSyncResult> {
  if (graphConfigured()) {
    try {
      return await syncViaGraph(actor);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Could not read the guest mailbox.";
      return { ok: false, reason, scanned: 0, created: 0, skipped: 0, replies: 0 };
    }
  }
  return syncViaImap(actor);
}
