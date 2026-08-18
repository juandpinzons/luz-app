"use client";

import { useIsOnline } from "@/features/native/use-network-status";

/**
 * Franja global, montada una sola vez en `AppShell` -- cubre
 * Dashboard/Vida/Recuerdos/Conversación con el mismo aviso, en vez de
 * que cada página tenga que implementar su propia detección. El
 * contenido que sigue visible mientras está sin conexión (mensajes ya
 * cargados, el saludo del Dashboard, etc.) puede quedar desactualizado
 * -- este aviso es la única señal de eso, no bloquea nada.
 */
export function OfflineBanner() {
  const isOnline = useIsOnline();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex-shrink-0 bg-luz/15 px-4 py-2 text-center text-xs text-luz sm:text-sm"
    >
      Sin conexión — viendo una versión guardada.
    </div>
  );
}
