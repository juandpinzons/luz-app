import type { EmailConnection } from "../domain";

/**
 * Desconectar es una transición de estado propia de LUZ, no una
 * operación del proveedor -- Gmail/Outlook no tienen ningún concepto de
 * "desconectar" que llamar (revocar el token es un asunto de la persona
 * dentro de su propia cuenta de Google, no algo que este caso de uso
 * inicie). Nunca borra la conexión, mismo criterio que
 * `disconnectCalendar` (`./disconnect-calendar.ts`): se conserva la
 * fila para no perder el historial de qué estuvo conectado. Función
 * pura, sin I/O.
 */
export function disconnectGmail(connection: EmailConnection): EmailConnection {
  return {
    ...connection,
    status: "disconnected",
    updatedAt: new Date(),
  };
}
