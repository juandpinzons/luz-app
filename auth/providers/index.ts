import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";

/**
 * Registro de proveedores de autenticación habilitados.
 *
 * Añadir un proveedor nuevo (GitHub, email, credentials...) es agregarlo
 * a este arreglo — ninguna otra parte de la Identity Layer, y mucho
 * menos el dominio (`core/`), necesita cambiar. Auth.js infiere las
 * credenciales de cada proveedor desde variables de entorno con el
 * patrón `AUTH_<PROVEEDOR>_ID` / `AUTH_<PROVEEDOR>_SECRET`.
 *
 * Google es el primer proveedor en desarrollo, no el único soportado:
 * la tabla `accounts` (ver auth/schema.ts) tiene clave primaria
 * (provider, providerAccountId), diseñada para que un mismo usuario
 * pueda tener varias cuentas vinculadas sin cambios de esquema.
 */
export const providers: Provider[] = [Google];
