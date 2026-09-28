import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Clock3, FileText, MapPin, Video } from "lucide-react";
import { PageHeading } from "@/components/medicita/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/mi-agenda")({ head: () => ({ meta: [
  { title: "Mi agenda — MediCita" }, { name: "description", content: "Consulta y administra tus próximas citas médicas." },
  { property: "og:title", content: "Mi agenda — MediCita" }, { property: "og:description", content: "Tus citas médicas en un solo lugar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
] }), component: MySchedule });

function Appointment({ online = false, past = false }: { online?: boolean; past?: boolean }) { return <Card className="shadow-none"><CardContent className="flex flex-col gap-5 p-5 md:flex-row md:items-center"><div className="flex w-20 shrink-0 flex-col items-center rounded-lg bg-surface-subtle py-3"><span className="text-xs font-bold uppercase text-primary">{past ? "Sep" : "Oct"}</span><strong className="text-3xl">{past ? "18" : online ? "02" : "08"}</strong><span className="text-xs text-muted-foreground">{past ? "Viernes" : online ? "Viernes" : "Jueves"}</span></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{online ? "Dra. Camila Rojas" : "Dr. Javier Muñoz"}</h3>{!past && <Badge className="border-transparent bg-success-soft text-success hover:bg-success-soft"><CheckCircle2 />Confirmada</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{online ? "Medicina general" : "Cardiología"}</p><div className="mt-3 flex flex-wrap gap-4 text-sm"><span className="flex items-center gap-2"><Clock3 className="size-4 text-primary" />{online ? "10:30 — 11:00" : "12:30 — 13:00"}</span><span className="flex items-center gap-2">{online ? <Video className="size-4 text-primary" /> : <MapPin className="size-4 text-primary" />}{online ? "Videollamada" : "Centro Médico Norte"}</span></div></div><div className="flex gap-2">{online && !past && <Button><Video />Entrar a la cita</Button>}<Button variant="outline"><FileText />Detalles</Button></div></CardContent></Card> }

function MySchedule() { return <><PageHeading eyebrow="Área de pacientes" title="Mi agenda" description="Revisa tus próximas atenciones, indicaciones y consultas anteriores." action={<Button><CalendarDays />Agendar nueva cita</Button>} /><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><Tabs defaultValue="proximas"><TabsList><TabsTrigger value="proximas">Próximas citas</TabsTrigger><TabsTrigger value="anteriores">Anteriores</TabsTrigger></TabsList><TabsContent value="proximas" className="mt-5 grid gap-4"><Appointment online /><Appointment /></TabsContent><TabsContent value="anteriores" className="mt-5"><Appointment past /></TabsContent></Tabs></div></> }
