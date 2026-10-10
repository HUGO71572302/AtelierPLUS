import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ateliers } from "@/db/schema";
import { getSessionUser, safeUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  if (!user.atelierId) return NextResponse.json({ atelier: null });

  const [atelier] = await db
    .select()
    .from(ateliers)
    .where(eq(ateliers.id, user.atelierId))
    .limit(1);

  return NextResponse.json({ atelier: atelier ?? null });
}

/** Patron only: updates the workshop identity shown on receipts and sheets. */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Seul le patron peut modifier le profil de l’atelier." }, { status: 403 });
  }
  if (!user.atelierId) {
    return NextResponse.json({ error: "Atelier non trouvé." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Le nom de l’atelier doit comporter au moins 2 caractères." }, { status: 400 });
  }
  const city = typeof body.city === "string" ? body.city.trim().slice(0, 100) || null : null;

  const [updated] = await db
    .update(ateliers)
    .set({ name, city, updatedAt: new Date() })
    .where(eq(ateliers.id, user.atelierId))
    .returning();

  return NextResponse.json({
    atelier: updated,
    user: safeUser({ ...user, atelierName: updated.name, atelierCity: updated.city }),
  });
}
