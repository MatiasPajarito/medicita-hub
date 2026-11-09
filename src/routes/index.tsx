import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileHeart,
  HeartPulse,
  MapPin,
  Search,
  ShieldCheck,
  Stethoscope,
  Video,
} from "lucide-react";
import { MediCitaIcon } from "@/components/common/MediCitaLogo";
import { DoctorDashboardView } from "@/components/medicita/DoctorDashboardView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediCita — Tu salud, a tu tiempo" },
      {
        name: "description",
        content:
          "Encuentra especialistas, agenda consultas y accede a telemedicina desde un solo lugar.",
      },
      { property: "og:title", content: "MediCita — Tu salud, a tu tiempo" },
      {
        property: "og:description",
        content: "Encuentra especialistas y agenda atención presencial o por videollamada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const specialties = [
  { name: "Medicina general", note: "Atención integral", icon: Stethoscope },
  { name: "Cardiología", note: "Salud cardiovascular", icon: HeartPulse },
  { name: "Salud mental", note: "Psicología y psiquiatría", icon: FileHeart },
  { name: "Telemedicina", note: "Consulta desde casa", icon: Video },
];

function HomePage() {
  const { signedIn, isDoctor, doctorData, email, loading } = useUserRole();

  if (signedIn && isDoctor) {
    return <DoctorDashboardView doctorData={doctorData} email={email} />;
  }

  return (
    <>
      <section className="border-b border-border bg-surface-subtle">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <Badge className="mb-5 border-primary/20 bg-clinical-soft text-primary hover:bg-clinical-soft">
              Atención simple y segura
            </Badge>
            <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl">
              Tu salud, a tu tiempo.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              Encuentra al especialista que necesitas y agenda atención presencial o por
              videollamada, sin llamadas ni esperas.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 gap-2 px-6 text-base font-bold shadow-clinical">
                <Link to="/medicos">
                  <Stethoscope className="size-5" />
                  Ver profesionales disponibles
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" />
                Datos protegidos
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" />
                Profesionales verificados
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-primary">Atención especializada</p>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Encuentra la atención adecuada</h2>
          </div>
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/medicos">
              Ver todas
              <ChevronRight />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {specialties.map(({ name, note, icon: Icon }) => (
            <Link
              key={name}
              to="/medicos"
              search={name === "Telemedicina" ? { modality: "telemedicina" } : { specialty: name }}
              className="group rounded-lg border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-clinical"
            >
              <span className="flex size-11 items-center justify-center rounded-lg bg-clinical-soft text-primary">
                <Icon />
              </span>
              <h3 className="mt-5 font-bold">{name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{note}</p>
              <span className="mt-5 flex items-center gap-1 text-sm font-semibold text-primary">
                Ver profesionales
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface-subtle">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <NextAppointmentSection signedIn={signedIn} isLoading={loading} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex gap-4">
            <CalendarDays className="mt-1 size-6 shrink-0 text-primary" />
            <div>
              <h3 className="font-bold">Agenda en minutos</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Compara horarios y elige la hora que mejor te acomode.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Video className="mt-1 size-6 shrink-0 text-primary" />
            <div>
              <h3 className="font-bold">Atención estés donde estés</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Conéctate con seguridad desde tu teléfono o computador.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <MapPin className="mt-1 size-6 shrink-0 text-primary" />
            <div>
              <h3 className="font-bold">Centros cercanos</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Encuentra atención presencial en tu ciudad.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function NextAppointmentSection({
  signedIn,
  isLoading,
}: {
  signedIn: boolean;
  isLoading: boolean;
}) {
  if (isLoading) return <div className="h-40 animate-pulse rounded-lg bg-muted/50" />;

  if (!signedIn) {
    return (
      <Card className="border-primary/20 bg-card shadow-clinical">
        <CardContent className="flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-clinical-soft text-primary">
              <MediCitaIcon className="size-8" />
            </span>
            <div>
              <h2 className="text-2xl font-bold">¿Primera vez en MediCita?</h2>
              <p className="mt-2 max-w-xl leading-7 text-muted-foreground">
                Crea tu cuenta o inicia sesión para agendar tus horas médicas, revisar tu historial
                y gestionar tus atenciones clínicas en un solo lugar.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/acceso" search={{ redirect: "/", mode: "registro" }}>
                Crear cuenta
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/acceso" search={{ redirect: "/", mode: "login" }}>
                Iniciar sesión
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-border bg-card shadow-none">
      <CardContent className="flex flex-col items-center p-8 text-center sm:p-10">
        <span className="flex size-14 items-center justify-center rounded-full bg-clinical-soft text-primary">
          <CalendarDays className="size-7" />
        </span>
        <h2 className="mt-4 text-2xl font-bold">Gestiona tus próximas atenciones</h2>
        <p className="mt-2 max-w-md leading-7 text-muted-foreground">
          Encuentra al profesional que necesitas o revisa el estado de tus citas agendadas.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/medicos">
              <Search />
              Ver profesionales disponibles
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/mi-agenda" search={{ tab: "upcoming" }}>
              <CalendarDays />
              Ir a Mi agenda
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
