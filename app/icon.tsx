import { ImageResponse } from "next/og";
import {
  buildMoonPhasePath,
  DEFAULT_MOON_PHASE,
  MOON_BACKGROUND,
  MOON_DARK_HALF,
  MOON_GOLD_HALF,
} from "@/components/ui/moon-phase-path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const R = 11;
const CENTER = 16;

/**
 * "La media luna" -- la luna no produce luz, la recibe y la devuelve;
 * el mismo gesto que LUZ hace con lo que la persona ya trae. Mismo
 * cálculo real que el ícono de iOS (`buildMoonPhasePath`, ver ese
 * archivo para el porqué de `DEFAULT_MOON_PHASE` y por qué no está
 * atado todavía a una señal real por persona).
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
          background: MOON_BACKGROUND,
        }}
      >
        <svg width={size.width} height={size.height} viewBox="0 0 32 32">
          <circle cx={CENTER} cy={CENTER} r={R} fill={MOON_DARK_HALF} />
          <path d={buildMoonPhasePath(CENTER, CENTER, R, DEFAULT_MOON_PHASE)} fill={MOON_GOLD_HALF} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
