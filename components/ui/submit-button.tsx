"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de un `<form action={serverAction}>` con estado de espera
 * visible — sin esto, tocar "Continuar con Google" o "Cerrar sesión"
 * no mostraba ninguna señal hasta que la navegación terminaba (OAuth
 * de Google, sobre todo en wifi de evento, puede tardar un momento
 * real). Ese silencio se lee como "¿esto funcionó?", no como una
 * persona esperando.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
