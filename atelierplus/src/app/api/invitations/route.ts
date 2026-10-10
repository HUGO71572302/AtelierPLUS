import { NextResponse } from "next/server";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { atelierInvitations } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { generateInvitationCode, hashInvitationCode, INVITATION_LIFETIME_DAYS } from "@/lib/invitations";

export const dynamic = "force-dynamic";

async function requireOwner() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };
  if (user.role !== "owner") {
    return { error: NextResponse.json({ error: "Seul le patron peut gérer les invitations." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const access = await requireOwner();
  if (access.error) return access.error;

  const atelierId = access.user.atelierId;
  if (!atelierId) return NextResponse.json({ invitations: [] });
  const condition = and(eq(atelierInvitations.atelierId, atelierId), isNull(atelierInvitations.usedAt), gt(atelierInvitations.expiresAt, new Date()));

  const invitations = await db
    .select({ id: atelierInvitations.id, expiresAt: atelierInvitations.expiresAt, createdAt: atelierInvitations.createdAt })
    .from(atelierInvitations)
    .where(condition)
    .orderBy(asc(atelierInvitations.expiresAt));
  return NextResponse.json({ invitations });
}

export async function POST() {
  const access = await requireOwner();
  if (access.error) return access.error;

  if (!access.user.atelierId) return NextResponse.json({ error: "Atelier introuvable." }, { status: 404 });
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateInvitationCode();
    try {
      const [created] = await db
        .insert(atelierInvitations)
        .values({
          atelierId: access.user.atelierId,
          codeHash: hashInvitationCode(code),
          role: "member",
          createdBy: access.user.id,
          expiresAt,
        })
        .returning({ id: atelierInvitations.id, expiresAt: atelierInvitations.expiresAt });
      return NextResponse.json({ id: created.id, code, expiresAt: created.expiresAt }, { status: 201 });
    } catch {
      // Retry with another random code if hash collision
    }
  }
  return NextResponse.json({ error: "Impossible de créer le code. Réessayez." }, { status: 500 });
}

export async function DELETE(request: Request) {
  const access = await requireOwner();
  if (access.error) return access.error;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invitation invalide." }, { status: 400 });

  if (!access.user.atelierId) return NextResponse.json({ error: "Atelier introuvable." }, { status: 404 });
  const condition = and(eq(atelierInvitations.id, id), eq(atelierInvitations.atelierId, access.user.atelierId), isNull(atelierInvitations.usedAt));

  await db.delete(atelierInvitations).where(condition);
  return NextResponse.json({ ok: true });
}
