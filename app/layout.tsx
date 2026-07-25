import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
 * Sourced de `core/persona` — antes de este sprint estos eran los
 * valores por defecto de `create-next-app`, nunca reemplazados
 * (visible en la pestaña del navegador y en cualquier resultado de
 * búsqueda o preview de link compartido).
 */
export const metadata: Metadata = {
  title: `${LUZ_IDENTITY.name} — ${LUZ_IDENTITY.essence}`,
  description: LUZ_IDENTITY.publicSummary,
};

/**
 * `viewportFit: "cover"` — sin esto, `env(safe-area-inset-*)` siempre
 * resuelve a 0 en iOS Safari, así que ningún padding de área segura
 * (composer del chat, `app/chat/page.tsx`) tendría efecto real en un
 * teléfono sin botón físico de inicio.
 */
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
