import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { atelierUsers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { generateRecoveryCode, hashCode } from "@/lib/recovery";

export const dynamic = "force-dynamic";

/**
 * Signed-in user: creates a new personal recovery code. The previous code stops
 * working immediately. The new code is returned once and never stored in clear.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const recoveryCode = generateRecoveryCode();
  await db
    .update(atelierUsers)
    .set({ recoveryCodeHash: hashCode(recoveryCode) })
    .where(eq(atelierUsers.id, user.id));

  return NextResponse.json({ recoveryCode });
}
