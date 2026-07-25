import { ImageResponse } from "next/og";
import { LUZ_IDENTITY } from "../core/persona";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Tarjeta de preview cuando alguien comparte el link de LUZ (Slack,
 * WhatsApp, X, LinkedIn...) — antes no existía ninguna, así que el
 * preview quedaba vacío o genérico. Mismo `LUZ_IDENTITY` que ya usa el
 * chat y la landing — nunca un texto de marketing aparte inventado
 * solo para esta imagen.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontSize: 96,
            fontWeight: 300,
            letterSpacing: 24,
            color: "#e3b168",
          }}
        >
          LUZ
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 36,
            fontWeight: 300,
            color: "#e5e5e5",
          }}
        >
          {LUZ_IDENTITY.essence}
        </div>
      </div>
    ),
    { ...size },
  );
}
