import { NextResponse } from "next/server";
import { signOut } from "@/auth";
import { getUserContext } from "@/auth/user-context";
import { deleteAccount } from "@/core/account/delete-account";
import { db } from "@/core/db/client";
import { createRequestId, logger } from "@/core/observability/logger";

/**
 * Borra la cuenta autenticada -- solo la propia, nunca recibe un
 * `userId` del cliente (evita por diseño cualquier posibilidad de
 * borrar la cuenta de otra persona). Borrado real (`deleteAccount`),
 * no una desactivación.
 */
export async function POST(): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/account/delete";

  const userContext = await getUserContext();
  if (!userContext) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  await deleteAccount(db, userContext.userId);

  logger.log({ event: "account.deleted", requestId, route, userId: userContext.userId });

  // Cascada de `deleteAccount` ya borró la fila de `sessions` de esta
  // sesión -- `signOut` limpia la cookie del lado del cliente, que de
  // otra forma quedaría apuntando a una sesión que ya no existe.
  await signOut({ redirect: false });

  return NextResponse.json({ ok: true });
}
