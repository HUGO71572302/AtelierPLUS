import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ateliers, atelierUsers } from "@/db/schema";
import type { SafeUser } from "@/lib/atelier-types";

const SESSION_COOKIE = "atelierplus_session";
const SESSION_COOKIE_CLIENT = "atelierplus_session_client";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function signingKey(): string {
  const configuredSecret = process.env.AUTH_SECRET?.trim();
  if (!configuredSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be configured to sign AtelierPLUS sessions in production.");
    }
    // Local development only.
    const developmentKey = process.env.DATABASE_URL;
    if (!developmentKey) throw new Error("Configure AUTH_SECRET before signing AtelierPLUS sessions.");
    return developmentKey;
  }
  if (configuredSecret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }
  return configuredSecret;
}

export function assertSessionSecurityConfiguration(): void {
  void signingKey();
}

/**
 * The signature covers the password hash. Changing or resetting the password
 * therefore invalidates every session issued before the change, automatically.
 */
function sessionSignature(payload: string, passwordHash: string): string {
  return createHmac("sha256", signingKey()).update(`${payload}|${passwordHash}`).digest("hex");
}

function cookieOptions(maxAge: number, httpOnly: boolean) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly,
    secure,
    // Lax protects against cross-site request forgery. The Bearer token mirrored in
    // the client storage keeps embedded/preview contexts working without SameSite=None.
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function safeUser(user: {
  id: string;
  atelierId?: string | null;
  atelierName?: string | null;
  atelierCity?: string | null;
  fullName: string;
  phone: string;
  role: "owner" | "member";
}): SafeUser {
  return {
    id: user.id,
    atelierId: user.atelierId ?? null,
    atelierName: user.atelierName ?? "Mon atelier",
    atelierCity: user.atelierCity ?? null,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
  };
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.trim().replace(/[\s().-]/g, "");
  return cleaned.startsWith("00") ? `+${cleaned.slice(2)}` : cleaned;
}

export function makePasswordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Creates a session, sets the cookies and returns the token for the client. */
export async function setSessionCookie(userId: string, passwordHash: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${userId}.${expiresAt}`;
  const token = `${payload}.${sessionSignature(payload, passwordHash)}`;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE, true));
  // Mirror cookie readable by the client: used when the browser refuses HttpOnly cookies.
  cookieStore.set(SESSION_COOKIE_CLIENT, token, cookieOptions(SESSION_MAX_AGE, false));
  return token;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", cookieOptions(0, true));
  cookieStore.set(SESSION_COOKIE_CLIENT, "", cookieOptions(0, false));
}

async function readSessionToken(): Promise<string | null> {
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const bearer = authorization.slice("Bearer ".length).trim();
    if (bearer) return bearer;
  }
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? cookieStore.get(SESSION_COOKIE_CLIENT)?.value ?? null;
}

export async function getSessionUser(): Promise<SafeUser | null> {
  const token = await readSessionToken();
  if (!token) return null;

  const [userId, expiresText, signature, extra] = token.split(".");
  if (!userId || !expiresText || !signature || extra || !UUID_PATTERN.test(userId)) return null;

  const expiresAt = Number(expiresText);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;

  const [row] = await db
    .select({
      id: atelierUsers.id,
      atelierId: atelierUsers.atelierId,
      atelierName: ateliers.name,
      atelierCity: ateliers.city,
      fullName: atelierUsers.fullName,
      phone: atelierUsers.phone,
      role: atelierUsers.role,
      passwordHash: atelierUsers.passwordHash,
    })
    .from(atelierUsers)
    .leftJoin(ateliers, eq(atelierUsers.atelierId, ateliers.id))
    .where(eq(atelierUsers.id, userId))
    .limit(1);
  if (!row) return null;

  const expected = Buffer.from(sessionSignature(`${userId}.${expiresText}`, row.passwordHash), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  return safeUser(row);
}
