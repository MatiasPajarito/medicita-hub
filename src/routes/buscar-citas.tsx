import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock3, MapPin, Search, Star, Video } from "lucide-react";
import { PageHeading } from "@/components/medicita/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/buscar-citas")({ head: () => ({ meta: [
  { title: "Buscar citas — MediCita" }, { name: "description", content: "Busca profesionales de salud por especialidad, modalidad y fecha." },
  { property: "og:title", content: "Buscar citas — MediCita" }, { property: "og:description", content: "Encuentra una hora médica disponible." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
] }), component: SearchAppointments });

const doctors = [
  { initials: "CR", name: "Dra. Camila Rojas", specialty: "Medicina general", place: "Clínica Central · Providencia", mode: "Presencial y videollamada", rating: "4,9", slots: ["10:30", "11:15", "16:00"] },
  { initials: "JM", name: "Dr. Javier Muñoz", specialty: "Cardiología", place: "Centro Médico Norte · Las Condes", mode: "Presencial", rating: "4,8", slots: ["09:00", "12:30", "17:15"] },
  { initials: "AF", name: "Dra. Antonella Gomez", specialty: "Salud mental", place: "Consulta online", mode: "Videollamada", rating: "5,0", slots: ["11:00", "14:00", "18:30"] },
];

function SearchAppointments() { return <>
  <PageHeading eyebrow="Agenda clínica" title="Encuentra una hora médica" description="Filtra por especialidad, profesional y fecha para ver disponibilidad en tiempo real." />
  <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <Card className="mb-8 shadow-none"><CardContent className="grid gap-3 p-4 md:grid-cols-[1.2fr_1fr_1fr_auto]">
      <Select><SelectTrigger className="h-11"><SelectValue placeholder="Especialidad" /></SelectTrigger><SelectContent><SelectItem value="general">Medicina general</SelectItem><SelectItem value="cardio">Cardiología</SelectItem><SelectItem value="mental">Salud mental</SelectItem></SelectContent></Select>
      <Input className="h-11" placeholder="Profesional o centro" /><Input className="h-11" type="date" /><Button className="h-11"><Search />Buscar</Button>
    </CardContent></Card>
    <div className="mb-5 flex items-center justify-between"><p className="font-semibold">24 profesionales disponibles</p><Select defaultValue="recomendados"><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recomendados">Recomendados</SelectItem><SelectItem value="proxima">Hora más próxima</SelectItem></SelectContent></Select></div>
    <div className="grid gap-4">{doctors.map((doctor) => <Card key={doctor.name} className="shadow-none"><CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div className="flex gap-4"><span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-clinical-soft font-bold text-primary">{doctor.initials}</span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{doctor.name}</h2><CheckCircle2 className="size-4 text-success" /></div><p className="mt-1 text-sm font-medium text-primary">{doctor.specialty}</p><p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" />{doctor.place}</p><div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Video className="size-4" />{doctor.mode}</span><span className="flex items-center gap-1"><Star className="size-4 fill-current text-success" />{doctor.rating}</span></div></div></div><div><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Próximas horas</p><div className="flex flex-wrap gap-2">{doctor.slots.map((slot) => <Button key={slot} variant="outline" size="sm"><Clock3 />{slot}</Button>)}</div></div></CardContent></Card>)}</div>
  </div>
</> }
