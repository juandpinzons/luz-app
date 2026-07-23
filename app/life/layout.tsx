import { AppShell } from "@/components/app-shell";

export default function LifeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell activeSection="life">{children}</AppShell>;
}
