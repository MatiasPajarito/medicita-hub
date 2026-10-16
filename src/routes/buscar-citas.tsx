import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, Search, Stethoscope } from "lucide-react";
import { PageHeading } from "@/components/medicita/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listDoctors } from "@/lib/clinical.functions";

export const Route = createFileRoute("/buscar-citas")({ head: () => ({ meta: [
  { title: "Buscar citas — MediCita" }, { name: "description", content: "Busca profesionales de salud por especialidad, modalidad y fecha." },
  { property: "og:title", content: "Buscar citas — MediCita" }, { property: "og:description", content: "Encuentra una hora médica disponible." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
] }), component: SearchAppointments });

const initials = (name: string) => name.replace(/^(Dra?\.)\s*/i, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function SearchAppointments() {
  const fetchDoctors = useServerFn(listDoctors);
  const doctors = useQuery({ queryKey: ["doctors"], queryFn: () => fetchDoctors() });
  const [specialty, setSpecialty] = useState("all");
  const [text, setText] = useState("");
  const specialties = useMemo(() => Array.from(new Set((doctors.data ?? []).map((d) => d.specialty))).sort(), [doctors.data]);
  const filtered = (doctors.data ?? []).filter((d) => (specialty === "all" || d.specialty === specialty) && d.full_name.toLowerCase().includes(text.trim().toLowerCase()));

  return <>
    <PageHeading eyebrow="Agenda clínica" title="Encuentra una hora médica" description="Filtra por especialidad y profesional para encontrar tu atención." />
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="mb-8 shadow-none"><CardContent className="grid gap-3 p-4 md:grid-cols-[1.2fr_1fr_auto]">
        <Select value={specialty} onValueChange={setSpecialty}><SelectTrigger className="h-11"><SelectValue placeholder="Especialidad" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las especialidades</SelectItem>{specialties.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Input className="h-11" placeholder="Nombre del profesional" value={text} onChange={(e) => setText(e.target.value)} />
        <Button className="h-11" variant="outline" onClick={() => { setSpecialty("all"); setText(""); }}><Search />Limpiar</Button>
      </CardContent></Card>
      {doctors.isLoading && <p className="text-muted-foreground">Cargando profesionales…</p>}
      {doctors.isError && <p className="text-destructive">No pudimos cargar los profesionales.</p>}
      {doctors.data && <p className="mb-5 font-semibold">{filtered.length} {filtered.length === 1 ? "profesional disponible" : "profesionales disponibles"}</p>}
      {doctors.data && filtered.length === 0 && <div className="py-16 text-center"><Stethoscope className="mx-auto size-10 text-muted-foreground" /><p className="mt-3 font-semibold">No hay profesionales que coincidan con tu búsqueda.</p></div>}
      <div className="grid gap-4">{filtered.map((doctor) => <Card key={doctor.id} className="shadow-none"><CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div className="flex gap-4">{doctor.photo_url ? <img src={doctor.photo_url} alt={doctor.full_name} className="size-14 shrink-0 rounded-full object-cover" /> : <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-clinical-soft font-bold text-primary">{initials(doctor.full_name)}</span>}<div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{doctor.full_name}</h2><CheckCircle2 className="size-4 text-success" /></div><p className="mt-1 text-sm font-medium text-primary">{doctor.specialty}</p><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{doctor.bio}</p><p className="mt-2 text-sm"><strong>${doctor.consultation_fee.toLocaleString("es-CL")}</strong> por consulta</p></div></div><Button><CalendarPlus />Agendar cita</Button></CardContent></Card>)}</div>
    </div>
  </>;
}
