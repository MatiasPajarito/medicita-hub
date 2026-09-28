import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  HeartPulse,
  Home,
  Menu,
  Search,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/" as const, label: "Inicio", mobileLabel: "Inicio", icon: Home },
  { to: "/buscar-citas" as const, label: "Buscar citas", mobileLabel: "Buscar", icon: Search },
  { to: "/mi-agenda" as const, label: "Mi agenda", mobileLabel: "Mis citas", icon: CalendarDays },
  { to: "/portal-profesional" as const, label: "Portal profesional", mobileLabel: "Portal", icon: Stethoscope },
];

export function MediCitaLogo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="MediCita, inicio">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-clinical">
        <HeartPulse className="size-5" strokeWidth={2.4} />
      </span>
      <span className="text-xl font-bold text-foreground">Medi<span className="text-primary">Cita</span></span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-17 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <MediCitaLogo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
            {navItems.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === to ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <Button asChild variant="ghost"><Link to="/acceso">Iniciar sesión</Link></Button>
            <Button asChild><Link to="/acceso">Crear cuenta</Link></Button>
          </div>
          <Button
            className="sm:hidden"
            variant="ghost"
            size="icon"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
        {open && (
          <div className="border-t border-border bg-background px-4 py-3 sm:hidden">
            <nav className="grid gap-1" aria-label="Navegación móvil">
              {navItems.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium hover:bg-accent">
                  <Icon className="size-4 text-primary" />{label}
                </Link>
              ))}
              <Link to="/acceso" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-3 rounded-md bg-primary px-3 py-3 text-sm font-medium text-primary-foreground">
                <UserRound className="size-4" /> Iniciar sesión / Registro
              </Link>
            </nav>
          </div>
        )}
      </header>
      <main className="pb-20 sm:pb-0">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-border bg-background/95 px-1 backdrop-blur sm:hidden" aria-label="Navegación inferior">
        {navItems.map(({ to, mobileLabel, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} className={cn("flex flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" />{mobileLabel}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
