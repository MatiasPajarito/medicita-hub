import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CalendarX2 } from "lucide-react";
import { PageHeading } from "@/components/medicita/page-heading";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/mi-agenda")({ head: () => ({ meta: [
  { title: "Mi agenda — MediCita" }, { name: "description", content: "Consulta y administra tus próximas citas médicas." },
  { property: "og:title", content: "Mi agenda — MediCita" }, { property: "og:description", content: "Tus citas médicas en un solo lugar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
] }), component: MySchedule });

function MySchedule() {
  return <>
    <PageHeading eyebrow="Área de pacientes" title="Mi agenda" description="Revisa tus próximas atenciones y consultas anteriores." action={<Button asChild><Link to="/buscar-citas"><CalendarDays />Agendar nueva cita</Link></Button>} />
    <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <CalendarX2 className="mx-auto size-12 text-muted-foreground" />
      <h2 className="mt-4 text-xl font-bold">Aún no tienes citas agendadas</h2>
      <p className="mt-2 text-muted-foreground">Cuando reserves una hora con un profesional, aparecerá aquí.</p>
      <Button asChild className="mt-6"><Link to="/buscar-citas">Buscar una hora</Link></Button>
    </div>
  </>;
}
