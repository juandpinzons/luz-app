# LUZ iOS — shell nativo (Capacitor)

Ver el plan completo de la misión para el diseño de fondo (puente de
login, arquitectura de push, fases). Este README es solo el estado
operativo de este directorio.

## Estado actual (2026-08-18)

- Fase 1 (shell + puente de login + push), Fase 2 (offline mínimo) y
  Fase 3 (Sign in with Apple) del plan están completas del lado de
  código.
- `ios/` ya existe, generado con `npx cap add ios`, y se verificó
  compilando y corriendo de verdad en iOS Simulator (Xcode 26.6, iOS
  26.5) -- el WKWebView carga la landing real de producción. `ios/`
  SÍ se commitea (convención estándar de Capacitor: contiene
  configuración de Xcode que `cap sync` no siempre puede regenerar
  sola); `node_modules/` y los artefactos de build de Xcode están en
  `.gitignore`.
- Pendiente, todo del lado del Founder (Fase 0, sin código posible de
  mi parte): inscripción en Apple Developer Program, Team/Bundle ID
  reales, capacidad Push Notifications, Associated Domains
  (`applinks:<dominio real>`, hoy sigue en `*.vercel.app`), APNs Auth
  Key, y agregar `https://luz-app-joinluz.vercel.app/api/mobile-auth/callback`
  como redirect URI autorizado en Google Cloud Console. El ícono/launch
  screen sigue siendo el placeholder de Capacitor -- reemplazar por los
  assets reales (negro `#000000` + dorado `#e3b168`, ver
  `app/icon.tsx`/`app/opengraph-image.tsx`) cuando se retome esta pieza.

## Comandos útiles

```bash
cd native
npm install
npx cap sync      # tras cambiar capacitor.config.ts o agregar un plugin
npx cap open ios  # abre el proyecto en Xcode
```

## Offline mínimo (Fase 2)

Alcance real, deliberadamente acotado ("mínimo" en el nombre de la
fase): cubre la sesión YA cargada que pierde conectividad a mitad de
uso (el caso común en un celular -- metro, ascensor, zona sin señal),
no el arranque en frío sin ninguna red. Arrancar la app sin conexión
alguna sigue siendo un WKWebView en blanco -- resolverlo de verdad
necesitaría una página de respaldo nativa servida antes de intentar
cargar `server.url`, que es un cambio de arquitectura de carga
distinto (mayor alcance, no fue lo que se pidió).

Piezas: `features/native/use-network-status.ts` (`useIsOnline()`,
patrón `useSyncExternalStore` -- ver `use-is-native.ts` para el
porqué), `OfflineBanner` montado en `AppShell`, y dos cachés en
`localStorage` (mismo patrón que `draft-storage.ts`, nunca un
requisito -- si falla o está vacío, se degrada al comportamiento de
hoy): `features/dashboard/dashboard-cache.ts` (saludo/fecha/línea de
continuidad, leído por `app/dashboard/error.tsx`) y
`features/chat/conversation-cache.ts` (mensajes de texto de la última
conversación puntual abierta, sin `imageData` a propósito -- ver
comentario ahí). Verificado de punta a punta contra una cuenta real
(`smoke/utils/test-account.ts`): banner aparece/desaparece con eventos
reales de `online`/`offline`, y ambos fallbacks (`error.tsx` del
Dashboard, catch de `loadConversation` en `/chat`) se probaron forzando
un fallo real y confirmando que muestran el contenido cacheado
correcto.

## Sign in with Apple (Fase 3)

A propósito, construida ANTES de que el Founder complete Apple
Developer Program: la verificación del `identityToken` no necesita
NINGUNA credencial de esa inscripción -- son las llaves PÚBLICAS de
Apple (`https://appleid.apple.com/auth/keys`), y el flujo nativo
(`ASAuthorizationAppleIDProvider`, no el flujo web con Services ID)
firma el JWT con el Bundle ID de la app, ya decidido (`com.joinluz.app`).
Verificado con un JWT real, firmado localmente con un par de llaves
RSA generado para la prueba (7 casos: firma real, firma corrupta,
`aud`/`iss` incorrectos, expirado, `kid` desconocido, formato
inválido) -- ninguno mockeado, la lógica de verificación se ejecutó de
verdad contra un servidor JWKS local. También se probó la creación/
reconocimiento de cuenta (`linkNativeAccountAndCreateSession`, ver
abajo) contra Postgres real.

Sin rama web -- guideline 4.8 de Apple solo aplica al binario que se
somete a revisión, nunca al sitio (no pasa por App Store Review), así
que `AppleSignInButton` solo renderiza dentro de la app nativa. Esto
es una desviación deliberada del texto original del plan (que mencionaba
agregar un provider en `auth/providers/index.ts`, el mecanismo de Auth.js
para el flujo WEB) -- se decidió no construirlo: exigiría su propia
configuración aparte en Apple Developer Portal (una Services ID, distinta
del Bundle ID) sin que ninguna guideline lo requiera.

Arquitectura MÁS SIMPLE que el puente de Google: sin navegador de
sistema, sin Universal Link -- `ASAuthorizationAppleIDProvider` autentica
dentro de la MISMA app (hoja modal nativa) y entrega el resultado
directo en JS, una sola llamada async. `POST /api/apple-auth/callback`
verifica el JWT y devuelve un código de intercambio; el paso final
reutiliza el MISMO `/api/mobile-auth/consume` que ya usaba Google --
agnóstico de proveedor desde su diseño original. La lógica de crear/
vincular la cuenta y abrir la sesión (antes duplicada en el callback de
Google) se extrajo a `auth/link-native-account-and-create-session.ts`,
compartida por los dos proveedores.

**Pendiente, del lado del Founder**: la capacidad "Sign In with Apple"
todavía necesita habilitarse en Xcode (Signing & Capabilities) -- a
diferencia de Push Notifications/Associated Domains, esta SÍ se puede
agregar con una cuenta de Apple gratuita para probar en un dispositivo
real, pero Apple Developer Program sigue haciendo falta para App Store
Connect/TestFlight/distribución real.

## Código nativo que YA vive en la app web (no en `native/`)

El WKWebView carga la URL de producción en vivo (ver `server.url` en
`capacitor.config.ts`) -- el código que llama a los plugins de
Capacitor (login vía navegador de sistema, registro de push, haptics,
etc.) vive en el propio código Next.js del repo raíz, gateado detrás de
`Capacitor.isNativePlatform()` para que nunca cambie el comportamiento
de la web normal. Ver `features/native/`.
