import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { writeAudit } from "./audit";
import { createSession } from "./auth";
import type { Role } from "./constants";
import { prisma } from "./prisma";

const hdb = createRequire(path.join(process.cwd(), "package.json"))("hdb") as {
  createClient: (opts: {
    host: string;
    port: number;
    user: string;
    password: string;
  }) => {
    connect: (cb: (err?: Error | null) => void) => void;
    prepare: (sql: string, cb: (err: Error | null, stmt?: { exec: (params: unknown[], cb: (err: Error | null, rows?: Record<string, unknown>[]) => void) => void }) => void) => void;
    end: () => void;
    on: (event: "error", cb: (err: Error) => void) => void;
  };
};

export const DEFAULT_INTRANET_COMPANY = "BI_NEGT";

const COMPANY_SCHEMAS = new Set([
  "BI_NEGT",
  "BI_NEGT_TEST",
  "BI_NESA",
  "BI_NEGTLLC",
  "BI_NEGT_KSA",
  "BI_NEGT_OMAN",
  "BI_NEGT_KW",
  "BI_NEGT_JPN",
  "BI_NEGT_BAHRAIN",
  "NEGTFZTEST",
  "BI_NEGT_BAHRAIN_TEST",
  "BI_NEGT_BAIC",
  "TEST_JMATCOBAIC",
  "BI_NEGT_AUTOLLC",
  "BI_NEGT_KSAISUZU",
  "BI_NEGT_KSAPARTS",
]);

const COMPANY_ALIASES: Record<string, string> = {
  BI_BAIC: "BI_NEGT_BAIC",
  BAIC: "BI_NEGT_BAIC",
};

const EMAIL_ALIASES: Record<string, string> = {
  "sakour@neweast.com": "sakour@neweast.co",
  "guru@neweast.com": "guru@neweast.co",
};

export function resolveCompanySchema(co?: string | null) {
  const raw = String(co || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!raw) return DEFAULT_INTRANET_COMPANY;
  if (COMPANY_SCHEMAS.has(raw)) return raw;
  const aliased = COMPANY_ALIASES[raw];
  if (aliased && COMPANY_SCHEMAS.has(aliased)) return aliased;
  const prefixed = raw.startsWith("BI_") ? raw : `BI_${raw}`;
  if (COMPANY_SCHEMAS.has(prefixed)) return prefixed;
  return DEFAULT_INTRANET_COMPANY;
}

export function emailCandidates(email: string) {
  const value = email.trim().toLowerCase();
  if (!value) return [];
  const aliases = [value];
  if (value.endsWith("@neweast.com")) aliases.push(value.replace(/@neweast\.com$/, "@neweast.co"));
  if (value.endsWith("@neweast.co")) aliases.push(value.replace(/@neweast\.co$/, "@neweast.com"));
  if (EMAIL_ALIASES[value]) aliases.push(EMAIL_ALIASES[value]);
  return [...new Set(aliases)];
}

export function readIntranetLink(input: { userId?: string | null; otp?: string | null; company?: string | null }) {
  const userId = String(input.userId || "").trim();
  const otp = String(input.otp || "").trim();
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(userId)) return null;
  if (!/^\d{4,8}$/.test(otp)) return null;
  return { userId, otp, company: resolveCompanySchema(input.company) };
}

type BiUser = {
  USER_ID: string;
  USER_EMAIL: string;
  EMP_FULLNAME: string;
  EMP_ID: string | number | null;
  PWDOTP: string | number | null;
  USER_ACTIVE: string;
};

function envValue(key: string) {
  try {
    const text = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      if (trimmed.slice(0, index) !== key) continue;
      let value = trimmed.slice(index + 1);
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value.replace(/\\n/g, "\n");
    }
  } catch {
    /* ignore */
  }
  return process.env[key] || "";
}

function hanaReady() {
  return Boolean(envValue("HANA_DB_HOST") && envValue("HANA_DB_USER") && envValue("HANA_DB_CREDENTIAL"));
}

function queryHana(sql: string, params: unknown[]) {
  return new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const client = hdb.createClient({
      host: envValue("HANA_DB_HOST"),
      port: Number(envValue("HANA_DB_PORT") || "30015"),
      user: envValue("HANA_DB_USER"),
      password: envValue("HANA_DB_CREDENTIAL"),
    });
    const finish = (err?: Error | null, rows?: Record<string, unknown>[]) => {
      try {
        client.end();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve(rows || []);
    };
    client.on("error", (err) => finish(err));
    client.connect((err) => {
      if (err) return finish(err);
      client.prepare(sql, (prepareErr, stmt) => {
        if (prepareErr || !stmt) return finish(prepareErr || new Error("HANA prepare failed."));
        stmt.exec(params, (execErr, rows) => finish(execErr, rows));
      });
    });
  });
}

function pick(row: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (row[name] != null) return row[name];
    const found = Object.keys(row).find((key) => key.toLowerCase() === name.toLowerCase());
    if (found && row[found] != null) return row[found];
  }
  return null;
}

async function fetchBiUser(userId: string, company: string): Promise<BiUser | null> {
  const rows = await queryHana(
    `SELECT USER_ID, USER_EMAIL, EMP_FULLNAME, EMP_ID, PWDOTP, USER_ACTIVE
     FROM "${company}".BI_USERMASTER
     WHERE USER_ID = ? AND USERTYPE = 'U'`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    USER_ID: String(pick(row, ["USER_ID"]) || ""),
    USER_EMAIL: String(pick(row, ["USER_EMAIL"]) || ""),
    EMP_FULLNAME: String(pick(row, ["EMP_FULLNAME"]) || ""),
    EMP_ID: (pick(row, ["EMP_ID"]) as string | number | null) ?? null,
    PWDOTP: (pick(row, ["PWDOTP"]) as string | number | null) ?? null,
    USER_ACTIVE: String(pick(row, ["USER_ACTIVE"]) || ""),
  };
}

async function findLocalUser(bi: BiUser) {
  const emails = emailCandidates(bi.USER_EMAIL);
  if (emails.length) {
    const byEmail = await prisma.user.findFirst({
      where: { isActive: true, email: { in: emails } },
    });
    if (byEmail) return byEmail;
  }
  const empId = bi.EMP_ID == null ? "" : String(bi.EMP_ID).trim();
  if (empId && empId !== "0") {
    return prisma.user.findFirst({
      where: { isActive: true, payrollNo: empId },
    });
  }
  return null;
}

export async function loginFromIntranetLink(input: {
  userId?: string | null;
  otp?: string | null;
  company?: string | null;
}) {
  const link = readIntranetLink(input);
  if (!link) return { ok: false as const, error: "This intranet link is missing a user or OTP." };
  if (!hanaReady()) return { ok: false as const, error: "Intranet sign-in is not configured." };

  let bi: BiUser | null = null;
  try {
    bi = await fetchBiUser(link.userId, link.company);
  } catch (error) {
    console.error("intranet-sso: directory lookup failed", error);
    return { ok: false as const, error: "Could not reach the intranet directory." };
  }
  if (!bi?.USER_ID) return { ok: false as const, error: "This intranet user was not found." };
  if (bi.USER_ACTIVE && bi.USER_ACTIVE !== "Y") {
    return { ok: false as const, error: "This intranet user is not active." };
  }
  if (String(bi.PWDOTP ?? "") !== link.otp) {
    return { ok: false as const, error: "This intranet link has expired. Open Guest Management from the intranet again." };
  }

  const user = await findLocalUser(bi);
  if (!user) {
    return {
      ok: false as const,
      error: "Your intranet account is not set up in Guest Management yet. Ask Administration.",
    };
  }

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    departmentId: user.departmentId,
    jobTitle: user.jobTitle,
    accessGroup: user.accessGroup,
  });
  await writeAudit({
    userId: user.id,
    action: "Signed in from intranet",
    module: "Auth",
    newValue: { userId: link.userId, company: link.company },
  });
  return { ok: true as const, role: user.role as Role };
}
