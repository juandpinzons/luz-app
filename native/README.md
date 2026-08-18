# LUZ iOS — shell nativo (Capacitor)

Ver el plan completo de la misión para el diseño de fondo (puente de
login, arquitectura de push, fases). Este README es solo el estado
operativo de este directorio.

## Estado actual (2026-08-18)

- `capacitor.config.ts` + `package.json` están listos.
- **Bloqueado**: este Mac de desarrollo no tiene Xcode instalado (solo
  Command Line Tools) -- `npx cap add ios` no puede correr todavía.
  Instalar Xcode desde la App Store es una acción del Founder (requiere
  su propia cuenta/contraseña de Apple, varios GB de descarga) -- no es
  algo que un agente pueda hacer por su cuenta.

## Próximos pasos, en orden, una vez exista Xcode

```bash
cd native
npm install
npx cap add ios
npx cap sync
npx cap open ios
```

Después de `cap add ios`, hace falta en Xcode (todo esto SÍ requiere
que la Fase 0 del plan -- inscripción en Apple Developer Program -- ya
esté hecha):

1. Configurar el Team/Bundle ID reales (Signing & Capabilities).
2. Habilitar la capacidad **Push Notifications**.
3. Habilitar **Associated Domains**, con `applinks:<dominio real>` --
   necesario para que el puente de login nativo (`app/api/mobile-auth/`)
   funcione vía Universal Links en vez de un fallback de navegador.
4. Reemplazar el ícono/launch screen placeholder por los assets reales
   (paleta de marca: negro `#000000` + dorado `#e3b168`, ver
   `app/icon.tsx`/`app/opengraph-image.tsx` en la raíz del repo).

## Código nativo que YA vive en la app web (no en `native/`)

El WKWebView carga la URL de producción en vivo (ver `server.url` en
`capacitor.config.ts`) -- el código que llama a los plugins de
Capacitor (login vía navegador de sistema, registro de push, haptics,
etc.) vive en el propio código Next.js del repo raíz, gateado detrás de
`Capacitor.isNativePlatform()` para que nunca cambie el comportamiento
de la web normal. Ver `features/native/`.
