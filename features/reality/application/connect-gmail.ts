import { type EntityId, createEntityId } from "../../../core/life/value-objects/entity-id";
import type { EmailConnection } from "../domain";
import type { EmailProvider } from "../providers";

export interface ConnectGmailInput {
  readonly lifeGraphId: EntityId;
  /** La dirección de correo de la cuenta -- opaco para este caso de uso, solo se guarda. En un flujo real de OAuth, este es el `email` ya conocido de la sesión de la persona (mismo dato que `connection.externalAccountId` termina siendo), nunca algo que este cimiento resuelve por su cuenta. */
  readonly externalAccountId: string;
}

/**
 * "Conectar" significa poder hablar de verdad con el proveedor, no solo
 * construir un objeto -- `provider.listLabels()` se llama una vez para
 * validar; unas credenciales inválidas fallan aquí, nunca en silencio
 * en el primer `synchronizeGmail()` más adelante. Mismo contrato que
 * `connectCalendar` (`./connect-calendar.ts`).
 *
 * `provider` ya viene construido e inyectado por el llamador (con sus
 * credenciales ya resueltas) -- este caso de uso nunca sabe cómo se
 * autentica. No persiste nada -- el `EmailConnection` devuelto es la
 * fila que un futuro llamador decide cómo y dónde guardar (ver
 * `../README.md`).
 */
export async function connectGmail(provider: EmailProvider, input: ConnectGmailInput): Promise<EmailConnection> {
  const now = new Date();

  const connection: EmailConnection = {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: input.lifeGraphId,
    providerKind: provider.kind,
    externalAccountId: input.externalAccountId,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await provider.listLabels(connection);

  return connection;
}
