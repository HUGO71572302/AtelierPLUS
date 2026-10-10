import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { atelierUsers, passwordResetRequests } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { generatePatronCode, hashCode, PATRON_CODE_TTL_MINUTES } from "@/lib/recovery";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Patron-only: lists the members waiting for a password reset in this workshop. */
async function requireOwner() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };
  if (user.role !== "owner") {
    return { error: NextResponse.json({ error: "Seul le patron gère les demandes de mot de passe." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const access = await requireOwner();
  if ("error" in access) return access.error;
  if (!access.user.atelierId) return NextResponse.json({ requests: [] });

  const rows = await db
    .select({
      id: passwordResetRequests.id,
      fullName: atelierUsers.fullName,
      phone: atelierUsers.phone,
      createdAt: passwordResetRequests.createdAt,
      codeExpiresAt: passwordResetRequests.codeExpiresAt,
      attempts: passwordResetRequests.attempts,
    })
    .from(passwordResetRequests)
    .innerJoin(atelierUsers, eq(passwordResetRequests.userId, atelierUsers.id))
    .where(and(
      eq(passwordResetRequests.atelierId, access.user.atelierId),
      isNull(passwordResetRequests.resolvedAt),
    ))
    .orderBy(asc(passwordResetRequests.createdAt));

  const now = Date.now();
  return NextResponse.json({
    requests: rows.map((row) => ({
      ...row,
      codeActive: Boolean(row.codeExpiresAt && row.codeExpiresAt.getTime() > now),
    })),
  });
}

/** Patron-only: creates a fresh 6-digit code for one request. Shown once. */
export async function POST(request: Request) {
  const access = await requireOwner();
  if ("error" in access) return access.error;
  if (!access.user.atelierId) return NextResponse.json({ error: "Atelier introuvable." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!UUID_PATTERN.test(requestId)) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });

  const [found] = await db
    .select({ id: passwordResetRequests.id })
    .from(passwordResetRequests)
    .where(and(
      eq(passwordResetRequests.id, requestId),
      eq(passwordResetRequests.atelierId, access.user.atelierId),
      isNull(passwordResetRequests.resolvedAt),
    ))
    .limit(1);
  if (!found) return NextResponse.json({ error: "Cette demande n’existe plus." }, { status: 404 });

  const code = generatePatronCode();
  const expiresAt = new Date(Date.now() + PATRON_CODE_TTL_MINUTES * 60 * 1000);
  await db
    .update(passwordResetRequests)
    .set({ codeHash: hashCode(code), codeExpiresAt: expiresAt, attempts: 0 })
    .where(eq(passwordResetRequests.id, found.id));

  return NextResponse.json({ code, expiresAt });
}

/** Patron-only: dismisses a request (e.g. the person is not a member of the workshop). */
export async function DELETE(request: Request) {
  const access = await requireOwner();
  if ("error" in access) return access.error;
  if (!access.user.atelierId) return NextResponse.json({ error: "Atelier introuvable." }, { status: 404 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });

  await db
    .update(passwordResetRequests)
    .set({ resolvedAt: new Date(), codeHash: null, codeExpiresAt: null })
    .where(and(
      eq(passwordResetRequests.id, id),
      eq(passwordResetRequests.atelierId, access.user.atelierId),
      isNull(passwordResetRequests.resolvedAt),
    ));
  return NextResponse.json({ ok: true });
}
