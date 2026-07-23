import { AppShell } from "@/components/app-shell";

/**
 * Cubre tanto /conversations (historial) como /conversations/[id]
 * (detalle) por anidamiento de Next.js — ambas pertenecen a la sección
 * "Conversación", igual que /chat.
 */
export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell activeSection="chat">{children}</AppShell>;
}
