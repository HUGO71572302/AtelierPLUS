import { NextResponse } from "next/server";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { phoneVariants } from "@/lib/countries";
import { db } from "@/db";
import { ateliers, atelierInvitations, atelierUsers } from "@/db/schema";
import { hashInvitationCode, normalizeInvitationCode } from "@/lib/invitations";
import { generateRecoveryCode, hashCode } from "@/lib/recovery";
import {
  assertSessionSecurityConfiguration,
  clearSessionCookie,
  getSessionUser,
  makePasswordHash,
  normalizePhone,
  safeUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import type { SafeUser } from "@/lib/atelier-types";

export const dynamic = "force-dynamic";

type AuthSuccess = { user: SafeUser; passwordHash: string; recoveryCode: string };
type AuthResult = AuthSuccess | { error: string; status: number };

export async function GET() {
  const user = await getSessionUser();
  if (user) return NextResponse.json({ user, needsSetup: false });

  const [firstUser] = await db.select({ id: atelierUsers.id }).from(atelierUsers).limit(1);
  return NextResponse.json({ user: null, needsSetup: !firstUser });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const action = body.action;
  if (action === "logout") {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  }

  if (action === "setup" || action === "register") {
    try {
      assertSessionSecurityConfiguration();
    } catch {
      return NextResponse.json({ error: "La configuration de sécurité de cet atelier est incomplète. Contactez son administrateur." }, { status: 503 });
    }

    const accountType = typeof body.accountType === "string" ? body.accountType : (typeof body.role === "string" ? body.role : "owner");
    const isOwnerSignup = accountType === "owner" || action === "setup";
    const workshopName = typeof body.workshopName === "string" ? body.workshopName.trim().slice(0, 100) : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const inviteCode = typeof body.inviteCode === "string" ? normalizeInvitationCode(body.inviteCode) : "";

    if (fullName.length < 2 || phone.length < 6 || phone.length > 20 || password.length < 8 || password.length > 200) {
      return NextResponse.json(
        { error: "Ajoutez votre nom, un numéro valide et un mot de passe d’au moins 8 caractères." },
        { status: 400 },
      );
    }

    let result: AuthResult;
    try {
      result = await db.transaction(async (transaction): Promise<AuthResult> => {
        await transaction.execute(sql`SELECT pg_advisory_xact_lock(4671028)`);

        const [phoneTaken] = await transaction
          .select({ id: atelierUsers.id })
          .from(atelierUsers)
          .where(inArray(atelierUsers.phone, phoneVariants(phone)))
          .limit(1);
        if (phoneTaken) return { error: "Ce numéro de téléphone possède déjà un compte. Connectez-vous.", status: 409 };

        const passwordHash = makePasswordHash(password);
        const recoveryCode = generateRecoveryCode();

        if (isOwnerSignup) {
          const finalWorkshopName = workshopName || (fullName ? `Atelier ${fullName}` : "Mon Atelier");
          const [newAtelier] = await transaction
            .insert(ateliers)
            .values({ name: finalWorkshopName })
            .returning({ id: ateliers.id, name: ateliers.name });

          const [createdOwner] = await transaction
            .insert(atelierUsers)
            .values({
              atelierId: newAtelier.id,
              fullName,
              phone,
              passwordHash,
              recoveryCodeHash: hashCode(recoveryCode),
              role: "owner",
            })
            .returning({
              id: atelierUsers.id,
              atelierId: atelierUsers.atelierId,
              fullName: atelierUsers.fullName,
              phone: atelierUsers.phone,
              role: atelierUsers.role,
            });

          return { user: safeUser({ ...createdOwner, atelierName: newAtelier.name }), passwordHash, recoveryCode };
        }

        // Member signup with an invitation code.
        if (inviteCode.length < 8) {
          return { error: "Un code d’invitation est nécessaire pour rejoindre un atelier existant. Demandez-le à votre patron.", status: 403 };
        }

        const [invitation] = await transaction
          .select({
            id: atelierInvitations.id,
            atelierId: atelierInvitations.atelierId,
            role: atelierInvitations.role,
          })
          .from(atelierInvitations)
          .where(and(
            eq(atelierInvitations.codeHash, hashInvitationCode(inviteCode)),
            isNull(atelierInvitations.usedAt),
            gt(atelierInvitations.expiresAt, new Date()),
          ))
          .for("update")
          .limit(1);

        if (!invitation) {
          return { error: "Ce code d’invitation est invalide, déjà utilisé ou expiré.", status: 403 };
        }

        const targetAtelierId = invitation.atelierId;
        if (!targetAtelierId) {
          return { error: "Ce code d’invitation est invalide. Demandez-en un nouveau à votre patron.", status: 403 };
        }

        const [createdMember] = await transaction
          .insert(atelierUsers)
          .values({
            atelierId: targetAtelierId,
            fullName,
            phone,
            passwordHash,
            recoveryCodeHash: hashCode(recoveryCode),
            role: "member",
          })
          .returning({
            id: atelierUsers.id,
            atelierId: atelierUsers.atelierId,
            fullName: atelierUsers.fullName,
            phone: atelierUsers.phone,
            role: atelierUsers.role,
          });

        await transaction
          .update(atelierInvitations)
          .set({ usedAt: new Date(), usedBy: createdMember.id })
          .where(eq(atelierInvitations.id, invitation.id));

        let atelierName = "Mon Atelier";
        if (targetAtelierId) {
          const [foundAtelier] = await transaction
            .select({ name: ateliers.name })
            .from(ateliers)
            .where(eq(ateliers.id, targetAtelierId))
            .limit(1);
          if (foundAtelier) atelierName = foundAtelier.name;
        }

        return { user: safeUser({ ...createdMember, atelierName }), passwordHash, recoveryCode };
      });
    } catch {
      return NextResponse.json({ error: "Création du compte impossible pour le moment. Réessayez." }, { status: 500 });
    }

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const token = await setSessionCookie(result.user.id, result.passwordHash);
    return NextResponse.json(
      { user: result.user, token, recoveryCode: result.recoveryCode, needsSetup: false },
      { status: 201 },
    );
  }

  if (action === "login") {
    try {
      assertSessionSecurityConfiguration();
    } catch {
      return NextResponse.json({ error: "La configuration de sécurité de cet atelier est incomplète. Contactez son administrateur." }, { status: 503 });
    }
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!phone || !password) {
      return NextResponse.json({ error: "Saisissez votre téléphone et votre mot de passe." }, { status: 400 });
    }

    const [user] = await db
      .select({
        id: atelierUsers.id,
        atelierId: atelierUsers.atelierId,
        atelierName: ateliers.name,
        fullName: atelierUsers.fullName,
        phone: atelierUsers.phone,
        passwordHash: atelierUsers.passwordHash,
        role: atelierUsers.role,
      })
      .from(atelierUsers)
      .leftJoin(ateliers, eq(atelierUsers.atelierId, ateliers.id))
      .where(inArray(atelierUsers.phone, phoneVariants(phone)))
      .limit(1);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Téléphone ou mot de passe incorrect." }, { status: 401 });
    }

    const currentUser = safeUser(user);
    const token = await setSessionCookie(currentUser.id, user.passwordHash);
    return NextResponse.json({ user: currentUser, token, needsSetup: false });
  }

  return NextResponse.json({ error: "Action non reconnue." }, { status: 400 });
}
