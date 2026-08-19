import { NextResponse } from "next/server";
import { z } from "zod";
import { linkNativeAccountAndCreateSession } from "@/auth/link-native-account-and-create-session";
import { db } from "@/core/db/client";
import { AppleIdentityTokenError, verifyAppleIdentityToken } from "@/core/apple-auth/verify-identity-token";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";

const bodySchema = z.object({
  identityToken: z.string().min(1),
  // Solo llega en la PRIMERA autorización que la persona le da a esta
  // app -- Apple nunca los repite en autenticaciones posteriores, ni
  // siquiera en el JWT. `null`/ausente es el caso normal para quien
  // vuelve a entrar, nunca un error. A diferencia de `identityToken`,
  // estos dos NO están firmados -- cualquiera con SU PROPIO
  // identityToken válido podría mandar cualquier texto acá (solo afecta
  // el `name` de SU PROPIA cuenta, nunca la de alguien más, ver
  // auditoría 2026-08-19), pero un tope de longitud es higiene barata
  // igual.
  givenName: z.string().min(1).max(200).optional(),
  familyName: z.string().min(1).max(200).optional(),
});

/**
 * Recibe el resultado de `SignInWithApple.authorize()`
 * (`@capacitor-community/apple-sign-in`, ver `apple-sign-in-button.tsx`)
 * -- a diferencia de `app/api/mobile-auth/callback/route.ts` (Google),
 * este NO es un redirect: el SDK nativo de Apple (`ASAuthorizationAppleIDProvider`)
 * ya autenticó a la persona con Apple directamente en el dispositivo
 * (Face ID/Touch ID/contraseña de Apple ID), sin navegador de sistema
 * ni WebView de por medio, y entrega el resultado directo en JS. Este
 * endpoint solo verifica que el `identityToken` sea un JWT real,
 * firmado por Apple, sin manipular (`verifyAppleIdentityToken`) --
 * nunca confía en el `sub`/`email` que el cliente también manda aparte
 * en JS, exactamente por la misma razón que ningún otro endpoint de
 * este dominio confía en datos de identidad sin verificar del lado del
 * cliente.
 *
 * POST, no GET -- no hay ninguna redirección real de por medio (a
 * diferencia de Google, que sí es un round-trip por el navegador de
 * sistema), así que tampoco hace falta cookie de estado ni protección
 * CSRF: la seguridad entera descansa en que el JWT esté firmado de
 * verdad por Apple, no en ningún secreto compartido con este request.
 *
 * Reutiliza `linkNativeAccountAndCreateSession` (mismo helper que
 * Google) para crear/vincular la cuenta y abrir la sesión, y el MISMO
 * `/api/mobile-auth/consume` para plantar la cookie real -- ese paso ya
 * es agnóstico de proveedor, nunca necesitó cambios.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/apple-auth/callback";

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    logger.log({ event: "apple_auth.callback.invalid_body", severity: "warn", requestId, route });
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  try {
    const identity = await verifyAppleIdentityToken(parsed.data.identityToken);

    if (!identity.email) {
      // Debería venir siempre que se pide el scope `email` -- si algún
      // día no viene, es mejor fallar explícito que crear una cuenta
      // sin email (`getUserByEmail` en `linkNativeAccountAndCreateSession`
      // lo necesita para resolver cuentas ya existentes).
      throw new Error("Apple no incluyó un email en el identityToken.");
    }

    const name = [parsed.data.givenName, parsed.data.familyName].filter(Boolean).join(" ") || null;

    const { exchangeCode, userId, isNewUser } = await linkNativeAccountAndCreateSession(db, {
      provider: "apple",
      providerAccountId: identity.sub,
      email: identity.email,
      emailVerified: identity.emailVerified,
      name,
      image: null,
      accountFields: {
        id_token: parsed.data.identityToken,
      },
    });

    logger.log({
      event: "apple_auth.callback.succeeded",
      requestId,
      route,
      userId,
      isNewUser,
    });

    return NextResponse.json({ exchangeCode });
  } catch (error) {
    const detail = describeError(error);
    const isTokenError = error instanceof AppleIdentityTokenError;
    logger.log({
      event: "apple_auth.callback.failed",
      severity: isTokenError ? "warn" : "error",
      requestId,
      route,
      ...detail,
    });
    if (!isTokenError) {
      await recordEvent(db, {
        type: "error",
        route,
        message: error instanceof Error ? error.message : String(error),
        metadata: { errorName: detail.errorName, errorCode: detail.errorCode },
      });
    }
    return NextResponse.json(
      { error: "No pudimos completar el inicio de sesión con Apple." },
      { status: isTokenError ? 401 : 500 },
    );
  }
}
