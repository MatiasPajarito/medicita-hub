import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileHeart,
  HeartPulse,
  MapPin,
  Search,
  ShieldCheck,
  Stethoscope,
  Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "MediCita — Tu salud, a tu tiempo" },
    { name: "description", content: "Encuentra especialistas, agenda consultas y accede a telemedicina desde un solo lugar." },
    { property: "og:title", content: "MediCita — Tu salud, a tu tiempo" },
    { property: "og:description", content: "Encuentra especialistas y agenda atención presencial o por videollamada." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HomePage,
});

const specialties = [
  { name: "Medicina general", note: "Atención integral", icon: Stethoscope },
  { name: "Cardiología", note: "Salud cardiovascular", icon: HeartPulse },
  { name: "Salud mental", note: "Psicología y psiquiatría", icon: FileHeart },
  { name: "Telemedicina", note: "Consulta desde casa", icon: Video },
];

function HomePage() {
  return (
    <>
      <section className="border-b border-border bg-surface-subtle">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-16">
          <div>
            <Badge className="mb-5 border-primary/20 bg-clinical-soft text-primary hover:bg-clinical-soft">Atención simple y segura</Badge>
            <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl">
              Tu salud, a tu tiempo.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              Encuentra al especialista que necesitas y agenda atención presencial o por videollamada, sin llamadas ni esperas.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/buscar-citas"><Search />Buscar una cita</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/portal-profesional">Soy profesional de salud<ArrowRight /></Link></Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" />Datos protegidos</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" />Profesionales verificados</span>
            </div>
          </div>

          <Card className="border-border/80 shadow-clinical">
            <CardContent className="p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div><p className="text-sm font-semibold text-primary">Agenda rápida</p><h2 className="mt-1 text-xl font-bold">¿Qué atención necesitas?</h2></div>
                <span className="flex size-11 items-center justify-center rounded-lg bg-clinical-soft text-primary"><CalendarCheck /></span>
              </div>
              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-semibold">Especialidad
                  <Select><SelectTrigger className="h-12 bg-background"><SelectValue placeholder="Selecciona una especialidad" /></SelectTrigger><SelectContent><SelectItem value="general">Medicina general</SelectItem><SelectItem value="cardio">Cardiología</SelectItem><SelectItem value="pediatria">Pediatría</SelectItem><SelectItem value="mental">Salud mental</SelectItem></SelectContent></Select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">Profesional o centro
                  <Input className="h-12 bg-background" placeholder="Nombre del profesional o clínica" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold">Fecha<Input className="h-12 bg-background" type="date" /></label>
                  <label className="grid gap-2 text-sm font-semibold">Modalidad
                    <Select defaultValue="todas"><SelectTrigger className="h-12 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="online">Videollamada</SelectItem></SelectContent></Select>
                  </label>
                </div>
                <Button asChild size="lg" className="mt-1 h-12"><Link to="/buscar-citas"><Search />Ver horas disponibles</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-sm font-bold text-primary">Atención especializada</p><h2 className="mt-1 text-2xl font-bold sm:text-3xl">Encuentra la atención adecuada</h2></div><Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/buscar-citas">Ver todas<ChevronRight /></Link></Button></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {specialties.map(({ name, note, icon: Icon }) => (
            <Link key={name} to="/buscar-citas" className="group rounded-lg border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-clinical">
              <span className="flex size-11 items-center justify-center rounded-lg bg-clinical-soft text-primary"><Icon /></span>
              <h3 className="mt-5 font-bold">{name}</h3><p className="mt-1 text-sm text-muted-foreground">{note}</p>
              <span className="mt-5 flex items-center gap-1 text-sm font-semibold text-primary">Ver profesionales<ChevronRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface-subtle">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <NextAppointmentSection />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><div className="grid gap-4 md:grid-cols-3"><div className="flex gap-4"><CalendarDays className="mt-1 size-6 shrink-0 text-primary" /><div><h3 className="font-bold">Agenda en minutos</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Compara horarios y elige la hora que mejor te acomode.</p></div></div><div className="flex gap-4"><Video className="mt-1 size-6 shrink-0 text-primary" /><div><h3 className="font-bold">Atención estés donde estés</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Conéctate con seguridad desde tu teléfono o computador.</p></div></div><div className="flex gap-4"><MapPin className="mt-1 size-6 shrink-0 text-primary" /><div><h3 className="font-bold">Centros cercanos</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Encuentra atención presencial en tu ciudad.</p></div></div></div></section>
    </>
  );
}
