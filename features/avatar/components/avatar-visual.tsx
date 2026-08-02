"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { AVATAR_ANIMATION_KIND, type AvatarAnimation } from "../domain/avatar-animation";
import { AVATAR_EMOTIONS, type AvatarEmotion } from "../domain/avatar-emotion";
import type { AvatarGazeTarget } from "../domain/avatar-gaze";

/**
 * Personaje definitivo -- boceto 3.0 (Founder, 2026-08-02): un bombillo,
 * vidrio arriba/rosca metálica abajo, ojos oscuros con brillo + chispa,
 * y un filamento como "alma" -- la energía del filamento (brillo/glow)
 * es lo que cambia con `intensity`/`animation`, la cara casi no cambia
 * entre estados (misma filosofía que Baymax/Luxo Jr. que citó el
 * Founder: personalidad desde pocos elementos + movimiento sutil,
 * nunca desde detalle acumulado). Sin brazos/piernas en reposo -- solo
 * aparecen para gestos reales (`wave`/`jump`/`hug`).
 *
 * Mismas dos capas independientes que ya recomienda
 * `features/avatar/README.md`: `animation` mueve el grupo completo
 * (cuerpo, vía `BODY_ANIMATION_CLASS`, mismo vocabulario
 * `animate-avatar-*` de siempre); `emotion` decide solo el contenido de
 * la cara (ojos/boca), cruzando por opacidad entre las cinco variantes
 * -- nunca un montaje/desmontaje que se lea como salto ("no sudden
 * jumps"). Este archivo es el único que decide QUÉ se pinta -- el
 * hook/estado/integración no saben nada de esto.
 */

const BODY_ANIMATION_CLASS: Record<AvatarAnimation, string> = {
  idle: "",
  listen: "animate-avatar-listen",
  think: "animate-avatar-think",
  sleep: "animate-avatar-sleep",
  wave: "animate-avatar-wave",
  jump: "animate-avatar-jump",
  hug: "animate-avatar-hug",
  nod: "animate-avatar-nod",
};

/** Solo estos tres gestos muestran brazos -- "un saludo o una necesidad" (Founder), nunca en reposo/loops (`idle`/`listen`/`think`/`sleep`), nunca en `nod` (un asentimiento no necesita brazos). */
const ARMS: Partial<Record<AvatarAnimation, ReactNode>> = {
  wave: <path d="M 156 148 Q 195 128 205 90" stroke="#2b2b2b" strokeWidth="8" strokeLinecap="round" fill="none" />,
  jump: (
    <>
      <path d="M 80 148 Q 46 118 58 82" stroke="#2b2b2b" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M 156 148 Q 190 118 178 82" stroke="#2b2b2b" strokeWidth="8" strokeLinecap="round" fill="none" />
    </>
  ),
  hug: (
    <>
      <path d="M 80 148 Q 60 172 102 180" stroke="#2b2b2b" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M 156 148 Q 176 172 134 180" stroke="#2b2b2b" strokeWidth="8" strokeLinecap="round" fill="none" />
    </>
  ),
};

const FACE_COLOR = "#241a10";

/** Coordenadas de cada rayo -- radiales pero deliberadamente irregulares (largo/ángulo variable), nunca perfectamente simétricas ("real", no generado por fórmula). */
const RAY_LINES = [
  { x1: 112, y1: 14, x2: 118, y2: -6 },
  { x1: 160, y1: 26, x2: 196, y2: 0 },
  { x1: 188, y1: 58, x2: 220, y2: 42 },
  { x1: 192, y1: 102, x2: 224, y2: 104 },
  { x1: 70, y1: 26, x2: 30, y2: 2 },
  { x1: 46, y1: 64, x2: 12, y2: 50 },
  { x1: 44, y1: 106, x2: 14, y2: 112 },
];

function Star({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <path
      d="M 0 -6 L 1.4 -1.4 L 6 0 L 1.4 1.4 L 0 6 L -1.4 1.4 L -6 0 L -1.4 -1.4 Z"
      fill="#ffe9a3"
      transform={`translate(${x} ${y}) scale(${scale})`}
    />
  );
}

function Eye({ cx, cy, star }: { cx: number; cy: number; star: boolean }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx="14" ry="18" fill={FACE_COLOR} />
      <circle cx={cx - 4} cy={cy - 7} r="4" fill="#ffffff" />
      {star && <Star x={cx + 6} y={cy - 10} />}
    </>
  );
}

/** Ojos+boca por `emotion` -- las cinco variantes se pintan siempre las cinco a la vez, cruzando por opacidad (ver el `<g>` de abajo), nunca montadas/desmontadas. `attentive` deliberadamente casi igual a `calm` (nunca hacia abajo/preocupada, ver README del backend). */
const FACE_BY_EMOTION: Record<AvatarEmotion, ReactNode> = {
  calm: (
    <>
      <Eye cx={95} cy={98} star={false} />
      <Eye cx={143} cy={95} star={false} />
      <path d="M 92 132 Q 118 148 145 129" stroke={FACE_COLOR} strokeWidth="6" strokeLinecap="round" fill="none" />
    </>
  ),
  happy: (
    <>
      <Eye cx={95} cy={98} star />
      <Eye cx={143} cy={95} star />
      <path d="M 90 126 Q 92 146 117 148 Q 142 146 145 124 Q 117 140 90 126 Z" fill={FACE_COLOR} />
      <path d="M 102 133 Q 117 140 132 133 Q 117 138 102 133 Z" fill="#c9603a" />
    </>
  ),
  curious: (
    <>
      <Eye cx={95} cy={93} star={false} />
      <Eye cx={143} cy={97} star />
      <ellipse cx={118} cy={132} rx="6" ry="8" fill={FACE_COLOR} />
    </>
  ),
  attentive: (
    <>
      <Eye cx={95} cy={97} star={false} />
      <Eye cx={143} cy={94} star={false} />
      <path d="M 92 131 Q 118 145 145 130" stroke={FACE_COLOR} strokeWidth="6" strokeLinecap="round" fill="none" />
    </>
  ),
  celebrating: (
    <>
      <Eye cx={95} cy={98} star />
      <Eye cx={143} cy={95} star />
      <path d="M 86 122 Q 88 150 117 153 Q 146 150 150 120 Q 117 144 86 122 Z" fill={FACE_COLOR} />
      <path d="M 100 131 Q 117 142 134 131 Q 117 138 100 131 Z" fill="#c9603a" />
    </>
  ),
};

const SLEEP_EYES = (
  <>
    <path d="M 82 94 Q 95 88 108 94" stroke={FACE_COLOR} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    <path d="M 130 91 Q 143 85 156 91" stroke={FACE_COLOR} strokeWidth="3.5" strokeLinecap="round" fill="none" />
  </>
);

/** Desplazamiento semántico de la mirada -- nunca coordenadas de pantalla, solo el grupo cara (ojos+boca), nunca el filamento/cuerpo. */
const GAZE_OFFSET: Record<AvatarGazeTarget, { x: number; y: number }> = {
  user: { x: 0, y: 0 },
  highlight: { x: 4, y: -2 },
  away: { x: -3, y: 3 },
};

export interface AvatarVisualProps {
  readonly emotion: AvatarEmotion;
  readonly animation: AvatarAnimation;
  /** 0-1 -- energía del filamento ("el alma" de LUZ, ver decisión del Founder): escala su brillo/glow, nunca genera una animación nueva. */
  readonly intensity: number;
  readonly gaze: AvatarGazeTarget;
  readonly blinking: boolean;
  readonly size: "xs" | "sm" | "md" | "lg";
}

export function AvatarVisual({ emotion, animation, intensity, gaze, blinking }: AvatarVisualProps) {
  const isAsleep = animation === "sleep";
  const isGesture = AVATAR_ANIMATION_KIND[animation] === "gesture";
  const gazeOffset = GAZE_OFFSET[gaze];
  const arms = isGesture ? ARMS[animation] : undefined;

  const filament = useMemo(() => {
    const glowRadius = isAsleep ? 14 : 24 + intensity * 20;
    const glowOpacity = isAsleep ? 0.12 : 0.35 + intensity * 0.45;
    const strokeOpacity = isAsleep ? 0.3 : 0.7 + intensity * 0.3;
    const color = !isAsleep && intensity > 0.65 ? "#ffcf5c" : isAsleep ? "#8a8370" : "#e8a53a";
    return { glowRadius, glowOpacity, strokeOpacity, color };
  }, [intensity, isAsleep]);

  const glowBgStyle = useMemo<CSSProperties>(
    () => ({
      background: `radial-gradient(circle at 50% 42%, rgba(244,211,94,${isAsleep ? 0.05 : 0.2 + intensity * 0.25}) 0%, transparent 72%)`,
    }),
    [intensity, isAsleep],
  );

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div aria-hidden="true" className="absolute inset-0 scale-150 rounded-full" style={glowBgStyle} />
      <svg
        viewBox="0 0 240 300"
        role="img"
        aria-label="LUZ"
        className={`relative h-full w-full ${isAsleep ? "" : "animate-avatar-breathe"}`}
      >
        <defs>
          <radialGradient id="avatar-glass" cx="32%" cy="24%" r="85%">
            <stop offset="0%" stopColor="#fffdf6" />
            <stop offset="55%" stopColor="#fdf3d9" />
            <stop offset="85%" stopColor="#f6e2ab" />
            <stop offset="100%" stopColor="#eeddb0" />
          </radialGradient>
          <linearGradient id="avatar-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#57575d" />
            <stop offset="50%" stopColor="#3a3a40" />
            <stop offset="100%" stopColor="#232327" />
          </linearGradient>
          <radialGradient id="avatar-filament-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe9a3" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffe9a3" stopOpacity="0" />
          </radialGradient>
          {/* Difumina los rayos/el resplandor -- sin esto se leen como clip-art (trazo sólido de borde duro), nunca como luz real. */}
          <filter id="avatar-soft-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>

        <g className={BODY_ANIMATION_CLASS[animation]} style={{ transformOrigin: "120px 150px", transformBox: "fill-box" }}>
          {/*
            Rayos -- apagados durante sleep, nunca una animación propia
            (solo opacidad estática por estado). Dos capas, mismo
            criterio que un glow real (halo ancho y difuminado detrás +
            núcleo delgado y nítido encima) -- nunca un solo trazo
            sólido de borde duro, que se lee como dibujado en vez de
            iluminado.
          */}
          <g opacity={isAsleep ? 0 : 0.6 + intensity * 0.35}>
            <g stroke="#f4d35e" strokeWidth="9" strokeLinecap="round" opacity="0.5" filter="url(#avatar-soft-glow)">
              {RAY_LINES.map((r) => (
                <line key={r.x1} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
              ))}
            </g>
            <g stroke="#ffedb0" strokeWidth="2" strokeLinecap="round" opacity="0.8">
              {RAY_LINES.map((r) => (
                <line key={r.x1} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
              ))}
            </g>
          </g>

          {arms}

          {/* rosca metálica */}
          <path d="M 84 152 L 156 152 L 154 196 Q 154 202 147 202 L 93 202 Q 86 202 86 196 Z" fill="url(#avatar-metal)" />
          <line x1="87" y1="163" x2="153" y2="163" stroke="#18181b" strokeWidth="2.5" />
          <line x1="87" y1="172" x2="152" y2="172" stroke="#6b6b72" strokeWidth="1.5" />
          <line x1="87" y1="181" x2="152" y2="181" stroke="#18181b" strokeWidth="2.5" />
          <line x1="87" y1="190" x2="151" y2="190" stroke="#6b6b72" strokeWidth="1.5" />

          {/* vidrio */}
          <path
            d="M 66 120 C 60 75, 75 28, 120 20 C 165 28, 180 75, 174 120 C 172 136, 164 146, 156 152 L 84 152 C 76 146, 68 136, 66 120 Z"
            fill="url(#avatar-glass)"
            stroke="#e4dcc4"
            strokeWidth="2"
          />

          {/*
            Filamento -- "el alma" (ver decisión del Founder): su
            energía (brillo/glow), nunca su forma, es lo que cambia con
            intensity/sleep. Blur + núcleo nítido, mismo criterio que
            los rayos -- un trazo sólido sin halo se lee como un cable
            dibujado, no como algo que emite luz.
          */}
          <circle cx="118" cy="112" r={filament.glowRadius} fill="url(#avatar-filament-glow)" opacity={filament.glowOpacity} />
          <g filter="url(#avatar-soft-glow)" opacity={filament.strokeOpacity * 0.7}>
            <path d="M 112 82 Q 126 89 116 97 Q 106 105 120 112 Q 130 118 118 125" stroke={filament.color} strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M 118 125 Q 108 134 103 152" stroke={filament.color} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d="M 118 125 Q 128 134 133 152" stroke={filament.color} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          </g>
          <path
            d="M 112 82 Q 126 89 116 97 Q 106 105 120 112 Q 130 118 118 125"
            stroke={filament.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity={filament.strokeOpacity}
          />
          <path d="M 118 125 Q 108 134 103 152" stroke={filament.color} strokeWidth="2" strokeLinecap="round" fill="none" opacity={filament.strokeOpacity} />
          <path d="M 118 125 Q 128 134 133 152" stroke={filament.color} strokeWidth="2" strokeLinecap="round" fill="none" opacity={filament.strokeOpacity} />
          <path d="M 112 82 L 109 68" stroke={filament.color} strokeWidth="2" strokeLinecap="round" opacity={filament.strokeOpacity} />

          {/* cara -- mirada desplaza solo este grupo */}
          <g transform={`translate(${gazeOffset.x}, ${gazeOffset.y})`}>
            <g className={blinking && !isAsleep ? "animate-avatar-blink" : ""} style={{ transformOrigin: "118px 96px", transformBox: "fill-box" }}>
              {AVATAR_EMOTIONS.map((candidate) => (
                <g key={candidate} style={{ opacity: !isAsleep && emotion === candidate ? 1 : 0, transition: "opacity 250ms ease-out" }}>
                  {FACE_BY_EMOTION[candidate]}
                </g>
              ))}
              <g style={{ opacity: isAsleep ? 1 : 0, transition: "opacity 250ms ease-out" }}>{SLEEP_EYES}</g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
