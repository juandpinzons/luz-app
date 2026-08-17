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

/** Desafío de sesión normal (ya enrolado) -- código correcto = cookie de sesión de MFA por 12h. */
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

  if (!credential?.verifiedAt) {
    return NextResponse.json({ error: "Todavía no hay MFA enrolado." }, { status: 400 });
  }

  const secret = decryptContent(credential.encryptedSecret);
  if (!verifyTotpCode(secret, parsed.data.code)) {
    return NextResponse.json({ error: "Código incorrecto." }, { status: 400 });
  }

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
