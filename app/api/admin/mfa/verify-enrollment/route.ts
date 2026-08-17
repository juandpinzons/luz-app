import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/core/db/client";
import { adminTotpCredentials } from "@/core/db/schema/admin-mfa";
import { isAdmin } from "@/app/admin/is-admin";
import { verifyTotpCode } from "@/core/security/totp";
import { decryptContent } from "@/core/security/content-cipher";
import {
  ADMIN_MFA_COOKIE_NAME,
  createAdminMfaSessionToken,
} from "@/core/security/admin-mfa-session";

const bodySchema = z.object({ code: z.string().length(6) });

/**
 * Confirma el enrolamiento: el admin escribe el código real de su app
 * de autenticación (prueba de que sí quedó bien configurada, no solo
 * que el secreto se guardó) -- recién ahí `verifiedAt` se marca y el
 * gate (`requireAdminMfa`) empieza a exigirlo. Éxito = también inicia
 * la sesión de MFA de una vez (mismo trato que un login exitoso),
 * para no pedir el código dos veces seguidas.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Código inválido -- deben ser 6 dígitos." }, { status: 400 });
  }

  const [credential] = await db
    .select()
    .from(adminTotpCredentials)
    .where(eq(adminTotpCredentials.adminUserId, session.user.id))
    .limit(1);

  if (!credential) {
    return NextResponse.json({ error: "Primero genera un secreto (POST /api/admin/mfa/enroll)." }, { status: 400 });
  }

  const secret = decryptContent(credential.encryptedSecret);
  if (!verifyTotpCode(secret, parsed.data.code)) {
    return NextResponse.json({ error: "Código incorrecto." }, { status: 400 });
  }

  await db
    .update(adminTotpCredentials)
    .set({ verifiedAt: new Date() })
    .where(eq(adminTotpCredentials.adminUserId, session.user.id));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_MFA_COOKIE_NAME, createAdminMfaSessionToken(session.user.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return response;
}
