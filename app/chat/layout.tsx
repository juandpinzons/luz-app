import { AppShell } from "@/components/app-shell";

/**
 * `contentOverflow="hidden"` reproduce exactamente el contenedor que
 * este layout ya tenía antes del Sprint 1 (`flex-1 overflow-hidden`) —
 * /chat gestiona su propio scroll interno; el shell no debe volver a
 * introducir el bug de "doble h-screen anidado" ya corregido antes.
 */
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell activeSection="chat" contentOverflow="hidden">
      {children}
    </AppShell>
  );
}
