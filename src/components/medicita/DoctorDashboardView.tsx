import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Stethoscope,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDoctorTitle, type DoctorData } from "@/hooks/useUserRole";
import { activeStatuses } from "@/lib/appointments";
import { clinicNow } from "@/lib/booking";
import { supabase } from "@/lib/supabase";

export interface DoctorDashboardViewProps {
  doctorData: DoctorData | null;
  email?: string | null | undefined;
}

export function DoctorDashboardView({ doctorData, email }: DoctorDashboardViewProps) {
  const now = clinicNow();
  const today = format(now, "yyyy-MM-dd");
  const weekEnd = format(addDays(now, 7), "yyyy-MM-dd");
  const doctorTitle = formatDoctorTitle(doctorData?.full_name, email);

  const metricsQuery = useQuery({
    queryKey: ["doctor-dashboard-metrics", doctorData?.id, today],
    queryFn: async () => {
      if (!doctorData?.id) {
        return {
          todayCount: 0,
          weekCount: 0,
          scheduleActive: true,
          upcomingPreview: [] as Array<{
            id: string;
            appointment_date: string;
            start_time: string;
            end_time: string;
            modality: string;
            status: string;
          }>,
        };
      }

      const [apptsRes, scheduleRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, appointment_date, start_time, end_time, modality, status")
          .eq("doctor_id", doctorData.id)
          .gte("appointment_date", today)
          .lte("appointment_date", weekEnd)
          .order("appointment_date", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("doctor_schedules")
          .select("id, is_available")
          .eq("doctor_id", doctorData.id),
      ]);

      const activeAppts = (apptsRes.data ?? []).filter((a) => activeStatuses.includes(a.status));
      const todayCount = activeAppts.filter((a) => a.appointment_date === today).length;
      const weekCount = activeAppts.length;
      const isDoctorActive = doctorData.is_active !== false;
      const hasAvailableSchedule =
        (scheduleRes.data ?? []).some((s) => s.is_available) || isDoctorActive;

      return {
        todayCount,
        weekCount,
        scheduleActive: isDoctorActive && hasAvailableSchedule,
        upcomingPreview: activeAppts.slice(0, 4),
      };
    },
  });

  const todayCount = metricsQuery.data?.todayCount ?? 0;
  const weekCount = metricsQuery.data?.weekCount ?? 0;
  const isScheduleActive = metricsQuery.data?.scheduleActive ?? doctorData?.is_active !== false;
  const upcomingPreview = metricsQuery.data?.upcomingPreview ?? [];

  return (
    <div className="min-h-[calc(100vh-4.25rem)] bg-surface-subtle/50">
      <section className="border-b border-border bg-surface-subtle">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <Badge className="mb-4 border-primary/25 bg-clinical-soft text-primary hover:bg-clinical-soft">
                <Stethoscope className="mr-1.5 size-3.5" />
                Portal Médico Profesional
              </Badge>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Bienvenido/a, {doctorTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {doctorData?.specialty
                  ? `Especialista en ${doctorData.specialty} · Gestiona tus pacientes citados, horarios de consulta y disponibilidad clínica.`
                  : "Gestiona tu agenda de pacientes, bloques horarios y disponibilidad de consulta desde tu panel médico."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2 shadow-clinical">
                <Link to="/doctor/citas">
                  <Users className="size-4" />
                  Ver agenda de pacientes
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2 bg-background">
                <Link to="/doctor/disponibilidad">
                  <CalendarClock className="size-4" />
                  Configurar horarios de atención
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card className="border-border/80 bg-card shadow-xs">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Citas de hoy
                  </p>
                  <p className="mt-2 text-3xl font-extrabold text-foreground">{todayCount}</p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {format(now, "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                </div>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-clinical-soft text-primary">
                  <Clock3 className="size-6" />
                </span>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card shadow-xs">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Próximas consultas de la semana
                  </p>
                  <p className="mt-2 text-3xl font-extrabold text-primary">{weekCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Próximos 7 días</p>
                </div>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-clinical-soft text-primary">
                  <CalendarDays className="size-6" />
                </span>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card shadow-xs">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Estado de agenda
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-2xl font-extrabold text-foreground">
                      {isScheduleActive ? "Activa" : "Inactiva"}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        isScheduleActive
                          ? "border-success/30 bg-success-soft text-success"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {isScheduleActive ? "Disponible" : "Sin publicar"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isScheduleActive
                      ? "Recibiendo reservas de pacientes"
                      : "Configura tus bloques para activar"}
                  </p>
                </div>
                <span
                  className={
                    isScheduleActive
                      ? "flex size-12 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success"
                      : "flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                  }
                >
                  <Activity className="size-6" />
                </span>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-foreground">Acciones directas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Link
            to="/doctor/disponibilidad"
            className="group flex items-start justify-between rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-clinical"
          >
            <div className="flex gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-clinical-soft text-primary">
                <CalendarClock className="size-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary">
                  Configurar horarios de atención
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Define tus días laborales, duración de cada bloque de consulta y pausas de
                  almuerzo.
                </p>
              </div>
            </div>
            <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </Link>

          <Link
            to="/doctor/citas"
            className="group flex items-start justify-between rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-clinical"
          >
            <div className="flex gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-clinical-soft text-primary">
                <Users className="size-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary">
                  Ver agenda de pacientes
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Revisa el listado de pacientes agendados, datos de contacto, RUT y registra
                  atenciones realizadas.
                </p>
              </div>
            </div>
            <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </Link>
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Próximas consultas agendadas</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/doctor/citas">
                Ver agenda de pacientes
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>

          {upcomingPreview.length === 0 ? (
            <Card className="border-dashed border-border bg-card shadow-none">
              <CardContent className="py-10 text-center">
                <CalendarDays className="mx-auto size-10 text-muted-foreground" />
                <p className="mt-3 font-semibold text-foreground">
                  No tienes consultas programadas para los próximos 7 días
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Asegúrate de mantener tus bloques horarios actualizados en Mi disponibilidad.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {upcomingPreview.map((item) => (
                <Card key={item.id} className="border-border/80 bg-card shadow-xs">
                  <CardContent className="flex items-center justify-between p-4 sm:p-5">
                    <div className="space-y-1">
                      <p className="text-sm font-bold capitalize text-foreground">
                        {format(parseISO(item.appointment_date), "EEEE d 'de' MMMM", {
                          locale: es,
                        })}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Clock3 className="size-3.5 text-primary" />
                        {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)} hrs
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      {item.modality === "telemedicina" ? (
                        <Video className="size-3.5 text-primary" />
                      ) : (
                        <MapPin className="size-3.5 text-primary" />
                      )}
                      {item.modality === "telemedicina" ? "Telemedicina" : "Presencial"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
