import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarDays,
  Home,
  LogOut,
  Menu,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { MediCitaLogo } from "@/components/common/MediCitaLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { clearCachedRoleData, useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const patientNavItems = [
  { to: "/" as const, label: "Inicio", mobileLabel: "Inicio", icon: Home },
  { to: "/medicos" as const, label: "Profesionales", mobileLabel: "Profesionales", icon: Stethoscope },
  { to: "/mi-agenda" as const, label: "Mi agenda", mobileLabel: "Mis citas", icon: CalendarDays },
];

const doctorNavItems = [
  { to: "/" as const, label: "Inicio", mobileLabel: "Inicio", icon: Home },
  {
    to: "/doctor/citas" as const,
    label: "Citas de Pacientes",
    mobileLabel: "Pacientes",
    icon: CalendarDays,
  },
  {
    to: "/doctor/disponibilidad" as const,
    label: "Mi disponibilidad",
    mobileLabel: "Horarios",
    icon: CalendarClock,
  },
];

function HeaderLogo() {
  return (
    <Link to="/" aria-label="MediCita, inicio">
      <MediCitaLogo />
    </Link>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { signedIn, isDoctor, doctorDisplayName, loading, isAuthReady } = useUserRole();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activeNavItems = isDoctor ? doctorNavItems : patientNavItems;

  async function signOut() {
    clearCachedRoleData();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/acceso", search: { redirect: "/", mode: "login" }, replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-17 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <HeaderLogo />
          {isAuthReady && isDoctor && (
            <Badge
              variant="secondary"
              className="hidden border-primary/25 bg-clinical-soft text-xs font-bold text-primary transition-opacity duration-300 sm:inline-flex"
            >
              Médico
            </Badge>
          )}
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
          {loading || !isAuthReady ? (
            <div className="flex items-center gap-2 transition-opacity duration-300">
              <Skeleton className="h-9 w-16 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          ) : (
            activeNavItems.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                  pathname === to
                    ? "bg-accent text-primary font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {label}
              </Link>
            ))
          )}
        </nav>

        <div className="hidden min-w-[180px] items-center justify-end gap-2 sm:flex">
          {loading || !isAuthReady ? (
            <div
              aria-label="Verificando sesión"
              className="flex items-center gap-2 transition-opacity duration-300"
            >
              <Skeleton className="h-9 w-36 rounded-md" />
              <Skeleton className="size-9 rounded-md" />
            </div>
          ) : signedIn ? (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <Button asChild className="gap-2">
                <Link to="/perfil">
                  {isDoctor ? (
                    <>
                      <Stethoscope className="size-4" />
                      <span>{doctorDisplayName || "Portal Médico"}</span>
                      <span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary-foreground">
                        Médico
                      </span>
                    </>
                  ) : (
                    <>
                      <UserRound className="size-4" />
                      <span>Mi perfil</span>
                    </>
                  )}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                onClick={signOut}
              >
                <LogOut />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <Button asChild variant="ghost">
                <Link to="/acceso" search={{ redirect: "/", mode: "login" }}>
                  Iniciar sesión
                </Link>
              </Button>
              <Button asChild>
                <Link to="/acceso" search={{ redirect: "/", mode: "registro" }}>
                  Crear cuenta
                </Link>
              </Button>
            </div>
          )}
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
        <div className="border-t border-border bg-background px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200 sm:hidden">
          <nav className="grid gap-1" aria-label="Navegación móvil">
            {activeNavItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors hover:bg-accent",
                  pathname === to && "bg-accent text-primary font-semibold",
                )}
              >
                <Icon className="size-4 text-primary" />
                {label}
              </Link>
            ))}

            {loading || !isAuthReady ? (
              <div className="grid gap-2 pt-2 transition-opacity duration-300">
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
            ) : signedIn ? (
              <>
                <Link
                  to="/perfil"
                  onClick={() => setOpen(false)}
                  className="mt-1 flex items-center justify-between rounded-md bg-primary px-3 py-3 text-sm font-medium text-primary-foreground"
                >
                  <span className="flex items-center gap-3">
                    {isDoctor ? (
                      <Stethoscope className="size-4" />
                    ) : (
                      <UserRound className="size-4" />
                    )}
                    {isDoctor ? doctorDisplayName || "Portal Médico" : "Mi perfil"}
                  </span>
                  {isDoctor && (
                    <span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase">
                      Médico
                    </span>
                  )}
                </Link>
                <Button
                  variant="ghost"
                  className="justify-start px-3"
                  onClick={() => {
                    setOpen(false);
                    void signOut();
                  }}
                >
                  <LogOut className="mr-2 size-4" />
                  Cerrar sesión
                </Button>
              </>
            ) : (
              <div className="grid gap-2 pt-2">
                <Link
                  to="/acceso"
                  search={{ redirect: "/", mode: "login" }}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center rounded-md border border-input py-2.5 text-sm font-medium hover:bg-accent"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/acceso"
                  search={{ redirect: "/", mode: "registro" }}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
                >
                  Crear cuenta
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function MobileBottomNav() {
  const { signedIn, isDoctor, loading, isAuthReady } = useUserRole();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeNavItems = isDoctor ? doctorNavItems : patientNavItems;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-border bg-background/95 px-1 backdrop-blur sm:hidden"
      aria-label="Navegación inferior"
    >
      {activeNavItems.map(({ to, mobileLabel, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              active ? "text-primary font-semibold" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {mobileLabel}
          </Link>
        );
      })}
      {loading || !isAuthReady ? (
        <div className="flex flex-col items-center justify-center gap-1">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-2.5 w-10 rounded" />
        </div>
      ) : signedIn ? (
        <Link
          to="/perfil"
          className={cn(
            "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
            pathname === "/perfil" ? "text-primary font-semibold" : "text-muted-foreground",
          )}
        >
          {isDoctor ? <Stethoscope className="size-5" /> : <UserRound className="size-5" />}
          {isDoctor ? "Portal Médico" : "Perfil"}
        </Link>
      ) : (
        <Link
          to="/acceso"
          search={{ redirect: "/", mode: "login" }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
            pathname === "/acceso" ? "text-primary font-semibold" : "text-muted-foreground",
          )}
        >
          <UserRound className="size-5" />
          Ingresar
        </Link>
      )}
    </nav>
  );
}
