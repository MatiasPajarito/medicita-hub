import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarDays,
  Home,
  LogOut,
  Menu,
  Search,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { MediCitaLogo } from "@/components/common/MediCitaLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const patientNavItems = [
  { to: "/" as const, label: "Inicio", mobileLabel: "Inicio", icon: Home },
  { to: "/buscar-citas" as const, label: "Buscar citas", mobileLabel: "Buscar", icon: Search },
  { to: "/medicos" as const, label: "Profesionales", mobileLabel: "Médicos", icon: Stethoscope },
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
  const { signedIn, isDoctor, doctorDisplayName } = useUserRole();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activeNavItems = isDoctor ? doctorNavItems : patientNavItems;

  async function signOut() {
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
          {isDoctor && (
            <Badge
              variant="secondary"
              className="hidden border-primary/25 bg-clinical-soft text-xs font-bold text-primary sm:inline-flex"
            >
              Médico
            </Badge>
          )}
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
          {activeNavItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === to
                  ? "bg-accent text-primary font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          {signedIn ? (
            <>
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
            </>
          ) : (
            <>
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
            </>
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
        <div className="border-t border-border bg-background px-4 py-3 sm:hidden">
          <nav className="grid gap-1" aria-label="Navegación móvil">
            {activeNavItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium hover:bg-accent",
                  pathname === to && "bg-accent text-primary font-semibold",
                )}
              >
                <Icon className="size-4 text-primary" />
                {label}
              </Link>
            ))}

            {signedIn ? (
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
  const { signedIn, isDoctor } = useUserRole();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeNavItems = isDoctor ? doctorNavItems : patientNavItems;

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid h-16 border-t border-border bg-background/95 px-1 backdrop-blur sm:hidden",
        isDoctor ? "grid-cols-4" : "grid-cols-5",
      )}
      aria-label="Navegación inferior"
    >
      {activeNavItems.map(({ to, mobileLabel, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
              active ? "text-primary font-semibold" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {mobileLabel}
          </Link>
        );
      })}
      {signedIn ? (
        <Link
          to="/perfil"
          className={cn(
            "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
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
            "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
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
