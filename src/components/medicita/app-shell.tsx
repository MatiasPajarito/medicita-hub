import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MobileBottomNav, Navbar } from "@/components/medicita/Navbar";

export { Navbar, MobileBottomNav };

export function AppShell({ children }: { children: ReactNode }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <div className="min-h-screen bg-background text-foreground dark:bg-slate-950 dark:text-slate-100 flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main
        key={currentPath}
        className="route-transition flex-1 pb-20 animate-in fade-in duration-200 fill-mode-forwards ease-out sm:pb-0"
      >
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
