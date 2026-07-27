import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sacramento } from "next/font/google";
import { LUZ_IDENTITY } from "../core/persona";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Único uso: la palabra "Welcome" del ritual de apertura de
 * conversación (`features/chat/components/conversation-opening-ritual.tsx`)
 * -- un trazo manual, no un titular. Peso único (400) a propósito:
 * Sacramento no tiene variantes, y una sola palabra nunca necesita
 * más de un peso.
 */
const sacramento = Sacramento({
  variable: "--font-sacramento",
  subsets: ["latin"],
  weight: "400",
});

/**
 * Sourced de `core/persona` — antes de este sprint estos eran los
 * valores por defecto de `create-next-app`, nunca reemplazados
 * (visible en la pestaña del navegador y en cualquier resultado de
 * búsqueda o preview de link compartido). `openGraph` se agrega para
 * Colombia Tech Week: el link se va a compartir antes de que nadie
 * abra la app, y la tarjeta de preview es la primera impresión real —
 * usa `app/opengraph-image.tsx`, no un archivo estático.
 */
const title = `${LUZ_IDENTITY.name} — ${LUZ_IDENTITY.essence}`;
const description = LUZ_IDENTITY.publicSummary;

export const metadata: Metadata = {
  // Sin esto, Next.js resuelve `app/opengraph-image.tsx` contra
  // "http://localhost:3000" incluso en producción (warning real visto
  // en `npm run build`) -- cualquier preview de link compartido
  // durante Colombia Tech Week habría apuntado a una URL rota.
  metadataBase: new URL("https://luz-app-joinluz.vercel.app"),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "es_CO",
  },
};

/**
 * `viewportFit: "cover"` — sin esto, `env(safe-area-inset-*)` siempre
 * resuelve a 0 en iOS Safari, así que ningún padding de área segura
 * (composer del chat, `app/chat/page.tsx`) tendría efecto real en un
 * teléfono sin botón físico de inicio. `themeColor` alinea la barra
 * del navegador (Android/iOS) con el fondo real del producto en vez
 * del blanco por defecto — antes, abrir LUZ en un teléfono mostraba un
 * destello de barra blanca antes de que cargara el negro.
 */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${sacramento.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
