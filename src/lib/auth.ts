import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { isFullAccess } from "./access";
import { prisma } from "./prisma";
import type { Role } from "./constants";
import type { SessionUser } from "./permissions";

const COOKIE = "neweast_session";

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
    jobTitle: user.jobTitle,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, secure: false, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      departmentId: (payload.departmentId as string) ?? null,
      jobTitle: (payload.jobTitle as string) ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { department: true },
  });
  if (!user || !user.isActive) return null;
  return {
    ...session,
    role: (isFullAccess(user.email) ? "SYSTEM_ADMIN" : user.role) as Role,
    departmentId: user.departmentId,
    jobTitle: user.jobTitle,
    accessGroup: user.accessGroup,
    departmentName: user.department?.name ?? null,
  };
}

export async function authenticate(_email: string, _password: string) {
  return null;
}
