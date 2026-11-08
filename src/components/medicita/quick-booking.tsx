import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookingDialog } from "@/components/medicita/booking-dialog";
import { fetchPublicDoctors } from "@/lib/doctors";
import { matchesSpecialty } from "@/lib/booking";

export function QuickBooking() {
  const doctors = useQuery({ queryKey: ["doctors"], queryFn: fetchPublicDoctors });
  const [specialty, setSpecialty] = useState("all");
  const [doctorId, setDoctorId] = useState("all");
  const [date, setDate] = useState("");
  const [modality, setModality] = useState("todas");
  const [open, setOpen] = useState(false);
  const filtered = (doctors.data ?? []).filter((doctor) => matchesSpecialty(doctor, specialty));
  const doctor = filtered.find((d) => d.id === doctorId) ?? null;
  const specialties = [...new Set((doctors.data ?? []).map((d) => d.specialty))].sort();
  return <><Card className="border-border/80 shadow-clinical"><CardContent className="p-5 sm:p-6">
    <div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-primary">Agenda rápida</p><h2 className="mt-1 text-xl font-bold">¿Qué atención necesitas?</h2></div><span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-clinical-soft text-primary"><CalendarCheck /></span></div>
    <div className="grid gap-4"><label className="grid gap-2 text-sm font-semibold">Especialidad<Select value={specialty} onValueChange={(value) => { setSpecialty(value); setDoctorId("all"); }}><SelectTrigger className="h-12 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las especialidades</SelectItem>{specialties.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></label>
    <label className="grid gap-2 text-sm font-semibold">Profesional o centro<Select value={doctorId} onValueChange={setDoctorId} disabled={doctors.isPending || doctors.isError}><SelectTrigger className="h-12 bg-background"><SelectValue placeholder="Seleccionar profesional" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los profesionales</SelectItem>{filtered.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent></Select></label>
    {doctors.isError && <p role="alert" className="text-sm text-destructive">No pudimos cargar los profesionales.</p>}
    <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Fecha<Input type="date" className="h-12 bg-background" value={date} onChange={(e) => setDate(e.target.value)} /></label><label className="grid gap-2 text-sm font-semibold">Modalidad<Select value={modality} onValueChange={setModality}><SelectTrigger className="h-12 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="telemedicina">Telemedicina</SelectItem></SelectContent></Select></label></div>
    {doctor ? <Button size="lg" className="h-12" onClick={() => setOpen(true)}><Search />Ver horas disponibles</Button> : <Button asChild size="lg" className="h-12"><Link to="/buscar-citas" search={{ specialty, date, modality }}><Search />Ver horas disponibles</Link></Button>}
    </div></CardContent></Card><BookingDialog doctor={open ? doctor : null} initialDate={date} initialModality={modality} onClose={() => setOpen(false)} /></>;
}