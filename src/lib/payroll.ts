import sql from "mssql";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { inferAccessGroup } from "./access";
import { APPROVER_PRESETS } from "./constants";

const EMAIL_ALIASES: Record<string, string> = {
  "sakour@neweast.com": "sakour@neweast.co",
  "guru@neweast.com": "guru@neweast.co",
};

export type PayrollRow = {
  PersonNumber: string | number | null;
  DisplayName: string | null;
  EmailAddress: string | null;
  EmailType: string | null;
  EmailAddress1: string | null;
  EmailType1: string | null;
  DepartmentName: string | null;
  JobName: string | null;
  ManagerName: string | null;
};

function clean(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

export function isCompanyEmail(email: string) {
  return /@(neweast\.com|neweast\.co)$/i.test(email);
}

export function payrollLoginEmail(row: {
  EmailAddress?: string | null;
  EmailType?: string | null;
  EmailAddress1?: string | null;
  EmailType1?: string | null;
}) {
  const slots = [
    { type: clean(row.EmailType).toUpperCase(), email: clean(row.EmailAddress).toLowerCase() },
    { type: clean(row.EmailType1).toUpperCase(), email: clean(row.EmailAddress1).toLowerCase() },
  ].filter((slot) => slot.email.includes("@"));
  const company = slots.find((slot) => isCompanyEmail(slot.email));
  const work = slots.find((slot) => slot.type.startsWith("W"));
  const chosen = company?.email || work?.email || slots[0]?.email || "";
  return EMAIL_ALIASES[chosen] ?? chosen;
}

function deptCode(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24) || "DEPT";
}

export async function fetchPayrollEmployees(): Promise<PayrollRow[]> {
  if (!process.env.SQL_DB_SERVER || !process.env.SQL_DB_USER) return [];
  const pool = await sql.connect({
    user: process.env.SQL_DB_USER,
    password: process.env.SQL_DB_PASSWORD,
    server: process.env.SQL_DB_SERVER,
    database: process.env.SQL_DB_DATABASE,
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  });
  try {
    const result = await pool.request().query(`
      SELECT PersonNumber, DisplayName, EmailAddress, EmailType, EmailAddress1, EmailType1, DepartmentName, JobName, ManagerName
      FROM dbo.Or_EmpMaster
      WHERE DisplayName IS NOT NULL
        AND TerminateDate IS NULL
      ORDER BY DisplayName
    `);
    return result.recordset as PayrollRow[];
  } finally {
    await pool.close();
  }
}

export async function syncPayrollEmployees() {
  const rows = await fetchPayrollEmployees();
  if (!rows.length) return { synced: 0, skipped: 0 };

  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, accessGroup: true, payrollNo: true } });
  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const byName = new Map(users.map((user) => [user.name.toLowerCase(), user]));
  const byPayroll = new Map(users.filter((user) => user.payrollNo).map((user) => [user.payrollNo as string, user]));
  const storedStub = await prisma.systemSetting.findUnique({ where: { key: "payroll_stub_hash" } });
  const common = storedStub?.value
    ? []
    : await prisma.user.groupBy({
        by: ["passwordHash"],
        where: { payrollNo: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { passwordHash: "desc" } },
        take: 1,
      });
  const stubHash = storedStub?.value || common[0]?.passwordHash || (await hashPassword(randomBytes(24).toString("hex")));
  if (!storedStub?.value) {
    await prisma.systemSetting.upsert({
      where: { key: "payroll_stub_hash" },
      update: { value: stubHash },
      create: { key: "payroll_stub_hash", value: stubHash },
    });
  }
  let synced = 0;
  let skipped = 0;

  const deptNames = [...new Set(rows.map((row) => clean(row.DepartmentName)).filter(Boolean))];
  const deptByName = new Map<string, string>();
  for (const name of deptNames) {
    const code = deptCode(name);
    const row = await prisma.department.upsert({
      where: { code },
      update: { name },
      create: { name, code },
    });
    deptByName.set(name.toLowerCase(), row.id);
  }

  for (const row of rows) {
    const name = clean(row.DisplayName);
    const email = payrollLoginEmail(row);
    if (!name || !email || !email.includes("@")) {
      skipped += 1;
      continue;
    }
    const departmentName = clean(row.DepartmentName);
    const departmentId = deptByName.get(departmentName.toLowerCase()) ?? null;
    const payrollNo = row.PersonNumber == null ? null : String(row.PersonNumber);
    const inferredGroup = inferAccessGroup({ role: "EMPLOYEE", departmentCode: deptCode(departmentName) });
    const existing =
      (payrollNo ? byPayroll.get(payrollNo) : undefined) ??
      byEmail.get(EMAIL_ALIASES[email] ?? email) ??
      byEmail.get(email) ??
      byName.get(name.toLowerCase());
    if (existing) {
      const taken = byEmail.get(email);
      const canMoveEmail = existing.email.toLowerCase() !== email && (!taken || taken.id === existing.id);
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          ...(canMoveEmail ? { email } : {}),
          jobTitle: clean(row.JobName) || null,
          managerName: clean(row.ManagerName) || null,
          payrollNo,
          departmentId,
          isActive: true,
          ...(existing.accessGroup || !inferredGroup ? {} : { accessGroup: inferredGroup }),
        },
      });
      if (canMoveEmail) {
        byEmail.delete(existing.email.toLowerCase());
        existing.email = email;
      }
      byEmail.set(existing.email.toLowerCase(), existing);
      byName.set(name.toLowerCase(), existing);
      if (payrollNo) byPayroll.set(payrollNo, existing);
    } else {
      const created = await prisma.user.create({
        data: {
          email,
          passwordHash: stubHash,
          name,
          role: "EMPLOYEE",
          jobTitle: clean(row.JobName) || null,
          managerName: clean(row.ManagerName) || null,
          payrollNo,
          departmentId,
          accessGroup: inferredGroup,
          isActive: true,
        },
      });
      byEmail.set(email, created);
      byName.set(name.toLowerCase(), created);
      if (payrollNo) byPayroll.set(payrollNo, created);
    }
    synced += 1;
  }

  const depts = await prisma.department.findMany({ select: { id: true, managerId: true } });
  for (const dept of depts) {
    if (dept.managerId) continue;
    const lead = await prisma.user.findFirst({
      where: { departmentId: dept.id, managerName: { not: null }, isActive: true },
      select: { managerName: true },
    });
    const manager = lead?.managerName ? byName.get(lead.managerName.toLowerCase()) : null;
    if (manager) {
      await prisma.department.update({ where: { id: dept.id }, data: { managerId: manager.id } });
    }
  }

  for (const preset of APPROVER_PRESETS) {
    if (!("email" in preset) || !preset.email) continue;
    const user = byEmail.get(preset.email) ?? byEmail.get(EMAIL_ALIASES[preset.email] ?? "");
    if (!user) continue;
    const current = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
    if (current && current.role === "EMPLOYEE") {
      await prisma.user.update({ where: { id: user.id }, data: { role: preset.role } });
    }
  }

  const aliasDupe = await prisma.user.findUnique({ where: { email: "sakour@neweast.com" }, select: { id: true, name: true, jobTitle: true, managerName: true, payrollNo: true, departmentId: true } });
  const aliasMain = await prisma.user.findUnique({ where: { email: "sakour@neweast.co" }, select: { id: true } });
  if (aliasDupe && aliasMain && aliasDupe.id !== aliasMain.id) {
    await prisma.user.update({
      where: { id: aliasMain.id },
      data: {
        name: aliasDupe.name,
        jobTitle: aliasDupe.jobTitle,
        managerName: aliasDupe.managerName,
        payrollNo: aliasDupe.payrollNo,
        departmentId: aliasDupe.departmentId,
      },
    });
    await prisma.user.update({ where: { id: aliasDupe.id }, data: { isActive: false } });
  }

  const activeEmails = new Set<string>(["sakour@neweast.co"]);
  const activeNos = new Set<string>();
  for (const row of rows) {
    const email = payrollLoginEmail(row);
    if (email.includes("@")) {
      activeEmails.add(email);
      if (EMAIL_ALIASES[email]) activeEmails.add(EMAIL_ALIASES[email]);
    }
    if (row.PersonNumber != null) activeNos.add(String(row.PersonNumber));
  }
  const candidates = await prisma.user.findMany({
    where: { isActive: true, role: { notIn: ["SYSTEM_ADMIN", "SECURITY_GUARD", "SECURITY_SUPERVISOR"] } },
    select: { id: true, email: true, payrollNo: true },
  });
  const staleIds = candidates
    .filter((user) => !activeEmails.has(user.email.toLowerCase()) && !(user.payrollNo && activeNos.has(user.payrollNo)))
    .map((user) => user.id);
  if (staleIds.length) {
    await prisma.user.updateMany({ where: { id: { in: staleIds } }, data: { isActive: false } });
  }
  await prisma.guestServiceOwner.deleteMany({
    where: { user: { OR: [{ isActive: false }, { payrollNo: null }] } },
  });

  await ensureHqLogins();

  await prisma.systemSetting.upsert({
    where: { key: "payroll_synced_at" },
    update: { value: new Date().toISOString() },
    create: { key: "payroll_synced_at", value: new Date().toISOString() },
  });

  return { synced, skipped };
}

export async function ensureHqLogins() {
  const admin = await prisma.user.findUnique({ where: { email: "adminsatror@neweast.co" } });
  if (!admin) {
    await prisma.user.create({
      data: {
        email: "adminsatror@neweast.co",
        passwordHash: await hashPassword("neweast123"),
        name: "System Administrator",
        role: "SYSTEM_ADMIN",
        isActive: true,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: "SYSTEM_ADMIN", name: "System Administrator", isActive: true },
    });
  }

  const guard = await prisma.user.findUnique({ where: { email: "security@neweast.co" } });
  if (!guard) {
    await prisma.user.create({
      data: {
        email: "security@neweast.co",
        passwordHash: await hashPassword("neweast123"),
        name: "Security Desk",
        role: "SECURITY_GUARD",
        isActive: true,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: guard.id },
      data: { role: "SECURITY_GUARD", name: "Security Desk", isActive: true },
    });
  }

  const sakour = await prisma.user.findUnique({ where: { email: "sakour@neweast.co" } });
  if (sakour) {
    await prisma.user.update({
      where: { id: sakour.id },
      data: { role: "SYSTEM_ADMIN", isActive: true },
    });
  }

  const daniel = await prisma.user.findUnique({ where: { email: "daniel@neweast.co" } });
  if (daniel && daniel.role === "SYSTEM_ADMIN") {
    await prisma.user.update({
      where: { id: daniel.id },
      data: { role: "EMPLOYEE", isActive: Boolean(daniel.payrollNo) },
    });
  }

  const mais = await prisma.user.findUnique({ where: { email: "mais.alhamwi@neweast.com" } });
  if (mais) {
    await prisma.user.update({
      where: { id: mais.id },
      data: { role: "HR_ADMIN", isActive: true, passwordHash: await hashPassword("neweast123") },
    });
  }

  const guru = await prisma.user.findUnique({ where: { email: "guru@neweast.co" } });
  if (guru) {
    await prisma.user.update({
      where: { id: guru.id },
      data: { role: "SYSTEM_ADMIN", isActive: true, passwordHash: await hashPassword("neweast123") },
    });
  }
}

export async function ensurePayrollSynced() {
  const stamp = await prisma.systemSetting.findUnique({ where: { key: "payroll_synced_at" } });
  const age = stamp?.value ? Date.now() - new Date(stamp.value).getTime() : Number.POSITIVE_INFINITY;
  if (age < 6 * 60 * 60 * 1000) return;
  try {
    await syncPayrollEmployees();
  } catch {
    // Keep the last local cache if payroll is unreachable.
  }
}

export async function findUserByName(name?: string | null) {
  const cleanName = clean(name);
  if (!cleanName) return null;
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  return users.find((user) => user.name.toLowerCase() === cleanName.toLowerCase()) ?? null;
}

export async function findUserByEmail(email?: string | null) {
  const value = clean(email).toLowerCase();
  if (!value) return null;
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  return users.find((user) => user.email.toLowerCase() === value) ?? null;
}
