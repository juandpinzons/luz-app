import { AppShell } from "@/components/app-shell";

export default function MemoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell activeSection="memories">{children}</AppShell>;
}
