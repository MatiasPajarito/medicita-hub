import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Stethoscope, UserRound } from "lucide-react";
import { PageHeading } from "@/components/medicita/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listDoctors } from "@/lib/clinical.functions";

export const Route = createFileRoute("/medicos")({ head: () => ({ meta: [
  { title: "Profesionales médicos — MediCita" }, { name: "description", content: "Conoce profesionales médicos activos y agenda tu próxima atención." },
  { property: "og:title", content: "Profesionales médicos — MediCita" }, { property: "og:description", content: "Directorio de profesionales médicos disponibles." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
] }), component: DoctorsDirectory });

function DoctorsDirectory() {
  const fetchDoctors = useServerFn(listDoctors);
  const doctors = useQuery({ queryKey: ["doctors"], queryFn: () => fetchDoctors() });
  return <><PageHeading eyebrow="Directorio clínico" title="Profesionales médicos" description="Encuentra el profesional adecuado y agenda una atención según tu necesidad." /><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{doctors.isLoading && <p className="text-muted-foreground">Cargando profesionales…</p>}{doctors.isError && <p className="text-destructive">No pudimos cargar el directorio.</p>}{doctors.data?.length === 0 && <div className="py-20 text-center"><Stethoscope className="mx-auto size-10 text-muted-foreground" /><h2 className="mt-4 text-xl font-bold">Aún no hay profesionales disponibles</h2></div>}<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{doctors.data?.map((doctor) => <Card key={doctor.id} className="overflow-hidden shadow-none"><div className="aspect-[16/10] bg-clinical-soft">{doctor.photo_url ? <img src={doctor.photo_url} alt={doctor.full_name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><UserRound className="size-16 text-primary/40" /></div>}</div><CardContent className="p-5"><Badge variant="secondary">{doctor.specialty}</Badge><h2 className="mt-3 text-xl font-bold">{doctor.full_name}</h2><p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-muted-foreground">{doctor.bio}</p><div className="mt-5 flex items-center justify-between gap-3"><span className="text-sm"><strong>${doctor.consultation_fee.toLocaleString("es-CL")}</strong> por consulta</span><Button asChild><Link to="/buscar-citas"><CalendarPlus />Agendar cita</Link></Button></div></CardContent></Card>)}</div></div></>;
}
