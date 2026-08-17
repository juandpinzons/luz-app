import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/core/db/client";
import { adminTotpCredentials } from "@/core/db/schema/admin-mfa";
import { isAdmin } from "@/app/admin/is-admin";
import { buildOtpAuthUri, generateTotpSecret } from "@/core/security/totp";
import { encryptContent } from "@/core/security/content-cipher";

/**
 * Genera (o regenera, si nunca se confirmó) un secreto TOTP pendiente
 * de verificar. Nunca sobrescribe una credencial YA verificada -- si
 * el admin quiere reenrolar un dispositivo nuevo, primero tendría que
 * borrar la fila existente (por diseño, ver docblock de
 * `admin-mfa.ts`: sin flujo multi-dispositivo en esta versión).
 */
export async function POST(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const [existing] = await db
    .select({ verifiedAt: adminTotpCredentials.verifiedAt })
    .from(adminTotpCredentials)
    .where(eq(adminTotpCredentials.adminUserId, session.user.id))
    .limit(1);

  if (existing?.verifiedAt) {
    return NextResponse.json(
      { error: "Ya hay una credencial verificada -- bórrala en la base antes de reenrolar." },
      { status: 400 },
    );
  }

  const secret = generateTotpSecret();

  await db
    .insert(adminTotpCredentials)
    .values({ adminUserId: session.user.id, encryptedSecret: encryptContent(secret) })
    .onConflictDoUpdate({
      target: adminTotpCredentials.adminUserId,
      set: { encryptedSecret: encryptContent(secret), verifiedAt: null },
    });

  return NextResponse.json({
    secret,
    otpauthUri: buildOtpAuthUri(secret, session.user.email),
  });
}
