import { prisma } from "./prisma";

export async function writeAudit(input: {
  userId?: string | null;
  visitId?: string | null;
  action: string;
  module: string;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      visitId: input.visitId ?? null,
      action: input.action,
      module: input.module,
      previousValue: input.previousValue == null ? null : JSON.stringify(input.previousValue),
      newValue: input.newValue == null ? null : JSON.stringify(input.newValue),
    },
  });
}

export async function addTimeline(input: {
  visitId: string;
  event: string;
  note?: string;
  userId?: string | null;
}) {
  await prisma.timelineEvent.create({
    data: {
      visitId: input.visitId,
      event: input.event,
      note: input.note,
      userId: input.userId ?? null,
    },
  });
}
