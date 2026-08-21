export type ActiveSection = "dashboard" | "life" | "memories" | "chat";

/**
 * Las cuatro secciones (Alpha Experience V1, docs/product/
 * ALPHA_EXPERIENCE_V1_DESIGN.md §4.1/5.1) -- único punto de verdad del
 * orden/href, compartido por `AppShell` (el nav de arriba) y
 * `SwipeSectionNavigation` (el gesto de deslizar). Vive en su propio
 * módulo, separado de ambos, a propósito: `app-shell.tsx` (Server
 * Component) y `swipe-section-navigation.tsx` ("use client") importándose
 * uno al otro por esta constante formaba una importación circular real
 * que rompía el build ("It is not allowed to define inline 'use server'
 * annotated Server Actions in Client Components" -- Next.js confundía
 * el límite server/client de `app-shell.tsx` por el ciclo).
 */
export const SECTIONS: Array<{
  id: ActiveSection;
  label: string;
  href: string;
}> = [
  { id: "dashboard", label: "Hoy", href: "/dashboard" },
  { id: "life", label: "Vida", href: "/life" },
  { id: "memories", label: "Recuerdos", href: "/memories" },
  { id: "chat", label: "Conversación", href: "/chat" },
];
