import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Antes de esto, la pestaña del navegador mostraba el favicon por
 * defecto de `create-next-app` (`app/favicon.ico`, nunca reemplazado)
 * — el mismo tipo de fuga de identidad genérica que ya se corrigió en
 * `app/layout.tsx` (metadata) y `components/Hero.tsx`. Mismo motivo
 * visual que `PresenceDot` (`components/ui/presence-dot.tsx`): un
 * punto cálido sobre negro, no un logotipo elaborado — a este tamaño,
 * un símbolo simple es lo único que se lee con claridad.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          borderRadius: "50%",
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#e3b168",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
