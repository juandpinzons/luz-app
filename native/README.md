# LUZ iOS — shell nativo (Capacitor)

Ver el plan completo de la misión para el diseño de fondo (puente de
login, arquitectura de push, fases). Este README es solo el estado
operativo de este directorio.

## Estado actual (2026-08-18)

- Fase 1 (shell + puente de login + push) y Fase 2 (offline mínimo) del
  plan están completas del lado de código.
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

## Código nativo que YA vive en la app web (no en `native/`)

El WKWebView carga la URL de producción en vivo (ver `server.url` en
`capacitor.config.ts`) -- el código que llama a los plugins de
Capacitor (login vía navegador de sistema, registro de push, haptics,
etc.) vive en el propio código Next.js del repo raíz, gateado detrás de
`Capacitor.isNativePlatform()` para que nunca cambie el comportamiento
de la web normal. Ver `features/native/`.
