import type { ReactNode } from "react";
import { MobileBottomNav, Navbar } from "@/components/medicita/Navbar";

export { Navbar, MobileBottomNav };

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pb-20 sm:pb-0">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
