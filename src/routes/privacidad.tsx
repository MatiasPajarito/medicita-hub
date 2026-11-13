import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileLock2, Scale, ShieldCheck, UserCheck, Video } from "lucide-react";
import { PageHeading } from "@/components/medicita/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APPLICABLE_LAWS, HEALTH_PRIVACY_POLICY_VERSION } from "@/lib/health-privacy";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Protección de Datos de Salud y Privacidad — MediCita" },
      {
        name: "description",
        content:
          "Política de tratamiento de datos clínicos, ficha médica y telemedicina conforme a las Leyes N° 19.628, N° 20.584 y N° 21.668 de Chile.",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeading
        eyebrow={`Normativa chilena vigente · Versión ${HEALTH_PRIVACY_POLICY_VERSION}`}
        title="Protección de Datos de Salud y Privacidad"
        description="En MediCita protegemos tus datos personales y antecedentes clínicos bajo estándares legales estrictos de confidencialidad, seguridad y control del paciente."
      />

      <div className="mt-8 space-y-6">
        <section aria-labelledby="marco-legal-heading" className="grid gap-4 md:grid-cols-3">
          <h2 id="marco-legal-heading" className="sr-only">
            Marco normativo aplicable
          </h2>
          {APPLICABLE_LAWS.map((law) => (
            <Card key={law.code} className="border-border bg-card shadow-card">
              <CardHeader className="pb-2">
                <Badge variant="secondary" className="w-fit font-semibold">
                  {law.code}
                </Badge>
                <CardTitle className="pt-2 text-base font-bold leading-snug">{law.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{law.summary}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileLock2 className="size-5 text-primary" aria-hidden="true" />
              Reserva y custodia de la ficha clínica (Ley N° 20.584)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-foreground">
            <p>
              Toda la información registrada en tu perfil de paciente, citas y notas clínicas tiene
              carácter de <strong>dato sensible y reservado</strong>. Solo pueden acceder a ella tú
              como titular y el equipo médico tratante autorizado mediante controles estrictos de
              acceso por rol (RLS).
            </p>
            <p className="text-muted-foreground">
              De acuerdo con el artículo 13 de la Ley N° 20.584, los antecedentes de la ficha
              clínica se conservan por un plazo mínimo de <strong>15 años</strong> contados desde el
              último registro clínico, protegidos contra pérdida, alteración o acceso no autorizado.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Video className="size-5 text-primary" aria-hidden="true" />
              Garantías específicas en Telemedicina (Ley N° 21.668)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-foreground">
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                Cada videoconsulta genera una sala privada cifrada y única vinculada exclusivamente
                a tu cita médica confirmada.
              </li>
              <li>
                MediCita <strong>no graba ni almacena audio o video</strong> de tus teleconsultas;
                únicamente el profesional tratante registra las indicaciones y diagnóstico en tu
                ficha clínica escrita.
              </li>
              <li>
                Previo al ingreso, verificas de forma local tus dispositivos de cámara y micrófono
                mediante WebRTC y confirmas tu atención en ambiente privado.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="size-5 text-primary" aria-hidden="true" />
              Tus derechos como titular (ARCO y Portabilidad)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface-subtle/60 p-3.5">
                <p className="flex items-center gap-1.5 font-semibold text-foreground">
                  <UserCheck className="size-4 text-primary" aria-hidden="true" />
                  Acceso y Rectificación
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Puedes revisar y actualizar tus datos personales, contacto de emergencia y
                  antecedentes directamente desde tu perfil.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface-subtle/60 p-3.5">
                <p className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Download className="size-4 text-primary" aria-hidden="true" />
                  Descarga y Portabilidad Clínica
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Exporta una copia completa de tus datos personales, citas y notas clínicas en
                  formato estructurado JSON en cualquier momento.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button asChild className="min-h-11 gap-2">
                <Link to="/perfil">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Gestionar consentimiento y descargar mis datos
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/medicos">Buscar especialistas</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
