import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { phoneVariants } from "@/lib/countries";
import { db } from "@/db";
import { atelierUsers } from "@/db/schema";
import { getSessionUser, makePasswordHash, normalizePhone, safeUser } from "@/lib/auth";

export async function POST(request: Request) {
  const currentUser = await getSessionUser();
  if (!currentUser) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  if (currentUser.role !== "owner") {
    return NextResponse.json({ error: "Seul le patron peut gérer les comptes de l’équipe." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (fullName.length < 2 || phone.length < 6 || password.length < 8) {
    return NextResponse.json(
      { error: "Ajoutez un nom, un téléphone et un mot de passe d’au moins 8 caractères." },
      { status: 400 },
    );
  }

  const [existing] = await db.select({ id: atelierUsers.id }).from(atelierUsers).where(inArray(atelierUsers.phone, phoneVariants(phone))).limit(1);
  if (existing) return NextResponse.json({ error: "Ce numéro possède déjà un compte." }, { status: 409 });

  try {
    const [created] = await db
      .insert(atelierUsers)
      .values({
        atelierId: currentUser.atelierId,
        fullName,
        phone,
        passwordHash: makePasswordHash(password),
        role: "member",
      })
      .returning({
        id: atelierUsers.id,
        atelierId: atelierUsers.atelierId,
        fullName: atelierUsers.fullName,
        phone: atelierUsers.phone,
        role: atelierUsers.role,
      });
    return NextResponse.json({
      member: created ? safeUser({ ...created, atelierName: currentUser.atelierName }) : null,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ce numéro possède déjà un compte." }, { status: 409 });
  }
}
