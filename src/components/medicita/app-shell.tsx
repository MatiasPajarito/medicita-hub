import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MobileBottomNav, Navbar } from "@/components/medicita/Navbar";

export { Navbar, MobileBottomNav };

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main
        key={pathname}
        className="pb-20 transition-opacity duration-300 ease-in-out motion-safe:animate-fadeIn sm:pb-0"
      >
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
