import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { phoneVariants } from "@/lib/countries";
import { db } from "@/db";
import { ateliers, atelierUsers, passwordResetRequests } from "@/db/schema";
import {
  assertSessionSecurityConfiguration,
  makePasswordHash,
  normalizePhone,
  safeUser,
  setSessionCookie,
} from "@/lib/auth";
import { codesMatch, generateRecoveryCode, hashCode, MAX_PATRON_ATTEMPTS } from "@/lib/recovery";

export const dynamic = "force-dynamic";

const WRONG_RECOVERY = "Téléphone ou code de secours incorrect. Vérifiez les informations saisies.";
const PATRON_CODE_INVALID = "Code incorrect, expiré ou trop de tentatives. Demandez un nouveau code au patron.";
const REQUEST_SENT = "Demande transmise au patron de l’atelier. Il vous donnera un code à 6 chiffres depuis son espace Mon équipe.";
const OWNER_HINT = "Vous êtes le patron de l’atelier : utilisez votre code de secours, reçu lors de la création de votre compte.";

function validNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 200;
}

/**
 * Public password recovery. Three modes:
 *  - "request":  a member asks the patron for a reset (no code is revealed here),
 *  - "recovery": anyone with the personal recovery code sets a new password,
 *  - "patron":   a member uses the 6-digit code given by the patron (5 tries max).
 * Every mode answers the same way whether or not the phone number exists, where possible.
 */
export async function POST(request: Request) {
  try {
    assertSessionSecurityConfiguration();
  } catch {
    return NextResponse.json({ error: "La configuration de sécurité de cet atelier est incomplète." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
  if (phone.length < 6) {
    return NextResponse.json({ error: "Saisissez le numéro de téléphone de votre compte." }, { status: 400 });
  }

  try {
    if (body.mode === "request") {
      const [user] = await db
        .select({ id: atelierUsers.id, atelierId: atelierUsers.atelierId, role: atelierUsers.role })
        .from(atelierUsers)
        .where(inArray(atelierUsers.phone, phoneVariants(phone)))
        .limit(1);

      if (user?.role === "owner") {
        return NextResponse.json({ ok: true, message: OWNER_HINT });
      }
      if (user?.atelierId) {
        const [open] = await db
          .select({ id: passwordResetRequests.id })
          .from(passwordResetRequests)
          .where(and(eq(passwordResetRequests.userId, user.id), isNull(passwordResetRequests.resolvedAt)))
          .limit(1);
        // One open request per member: pressing the button twice does not spam the patron.
        if (!open) {
          await db.insert(passwordResetRequests).values({ userId: user.id, atelierId: user.atelierId });
        }
      }
      return NextResponse.json({ ok: true, message: REQUEST_SENT });
    }

    if (body.mode === "recovery") {
      const code = typeof body.code === "string" ? body.code : "";
      if (!validNewPassword(body.newPassword)) {
        return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
      }
      const [user] = await db
        .select({
          id: atelierUsers.id,
          atelierId: atelierUsers.atelierId,
          atelierName: ateliers.name,
          fullName: atelierUsers.fullName,
          phone: atelierUsers.phone,
          role: atelierUsers.role,
          recoveryCodeHash: atelierUsers.recoveryCodeHash,
        })
        .from(atelierUsers)
        .leftJoin(ateliers, eq(atelierUsers.atelierId, ateliers.id))
        .where(inArray(atelierUsers.phone, phoneVariants(phone)))
        .limit(1);

      if (!user || !user.recoveryCodeHash || !codesMatch(hashCode(code), user.recoveryCodeHash)) {
        return NextResponse.json({ error: WRONG_RECOVERY }, { status: 400 });
      }

      const passwordHash = makePasswordHash(body.newPassword);
      // The recovery code is single-use: a new one is issued and shown once.
      const nextRecoveryCode = generateRecoveryCode();
      await db
        .update(atelierUsers)
        .set({ passwordHash, recoveryCodeHash: hashCode(nextRecoveryCode) })
        .where(eq(atelierUsers.id, user.id));

      const token = await setSessionCookie(user.id, passwordHash);
      return NextResponse.json({ ok: true, user: safeUser(user), token, recoveryCode: nextRecoveryCode });
    }

    if (body.mode === "patron") {
      const digits = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
      if (digits.length !== 6) {
        return NextResponse.json({ error: "Le code comporte 6 chiffres." }, { status: 400 });
      }
      if (!validNewPassword(body.newPassword)) {
        return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
      }

      const [user] = await db
        .select({ id: atelierUsers.id, atelierId: atelierUsers.atelierId, atelierName: ateliers.name, fullName: atelierUsers.fullName, phone: atelierUsers.phone, role: atelierUsers.role })
        .from(atelierUsers)
        .leftJoin(ateliers, eq(atelierUsers.atelierId, ateliers.id))
        .where(inArray(atelierUsers.phone, phoneVariants(phone)))
        .limit(1);
      if (!user) return NextResponse.json({ error: PATRON_CODE_INVALID }, { status: 400 });

      const [pending] = await db
        .select()
        .from(passwordResetRequests)
        .where(and(
          eq(passwordResetRequests.userId, user.id),
          isNull(passwordResetRequests.resolvedAt),
          isNotNull(passwordResetRequests.codeHash),
        ))
        .orderBy(desc(passwordResetRequests.createdAt))
        .limit(1);

      if (
        !pending || !pending.codeHash || !pending.codeExpiresAt ||
        pending.codeExpiresAt.getTime() < Date.now() ||
        pending.attempts >= MAX_PATRON_ATTEMPTS
      ) {
        return NextResponse.json({ error: PATRON_CODE_INVALID }, { status: 400 });
      }

      if (!codesMatch(hashCode(digits), pending.codeHash)) {
        await db
          .update(passwordResetRequests)
          .set({ attempts: sql`${passwordResetRequests.attempts} + 1` })
          .where(eq(passwordResetRequests.id, pending.id));
        return NextResponse.json({ error: PATRON_CODE_INVALID }, { status: 400 });
      }

      const passwordHash = makePasswordHash(body.newPassword);
      await db.transaction(async (transaction) => {
        await transaction.update(atelierUsers).set({ passwordHash }).where(eq(atelierUsers.id, user.id));
        // Close every open request of this member: the code cannot be used twice.
        await transaction
          .update(passwordResetRequests)
          .set({ resolvedAt: new Date(), codeHash: null, codeExpiresAt: null })
          .where(and(eq(passwordResetRequests.userId, user.id), isNull(passwordResetRequests.resolvedAt)));
      });

      const token = await setSessionCookie(user.id, passwordHash);
      return NextResponse.json({ ok: true, user: safeUser(user), token, recoveryCode: null });
    }

    return NextResponse.json({ error: "Action non reconnue." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Opération impossible pour le moment. Réessayez." }, { status: 500 });
  }
}
