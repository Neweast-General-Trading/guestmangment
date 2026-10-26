import { randomBytes } from "crypto";
import { prisma } from "./prisma";

export async function nextVisitCode(year = new Date().getFullYear()) {
  const key = `visit_seq_${year}`;
  const current = await prisma.systemSetting.findUnique({ where: { key } });
  const next = (current ? Number(current.value) : 0) + 1;
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(next) },
    create: { key, value: String(next) },
  });
  return `GV-${year}-${String(next).padStart(6, "0")}`;
}

export function makeQrToken() {
  return randomBytes(16).toString("hex");
}

export async function nextBadgeNumber() {
  const key = "badge_seq";
  const current = await prisma.systemSetting.findUnique({ where: { key } });
  const next = (current ? Number(current.value) : 1000) + 1;
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(next) },
    create: { key, value: String(next) },
  });
  return `VB-${next}`;
}

export function parseVisitCodeSeq(code: string, year: number) {
  const match = code.match(/^GV-(\d{4})-(\d{6})$/);
  if (!match) return null;
  if (Number(match[1]) !== year) return null;
  return Number(match[2]);
}
