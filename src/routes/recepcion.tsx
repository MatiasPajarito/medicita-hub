import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Hash,
  IdCard,
  MapPin,
  RotateCcw,
  Search,
  Stethoscope,
  UserCheck,
  UserRound,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "@/components/medicita/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeAppointmentStatus } from "@/lib/appointments";
import { normalizeRut } from "@/lib/clinical-schemas";
import { requireRole } from "@/lib/route-guards";
import { supabase } from "@/lib/supabase";

export interface ReceptionAppointmentItem {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  modality: string;
  status: "confirmed" | "scheduled" | "completed" | "cancelled";
  rawStatus: string;
  checked_in_at: string | null;
  orderCode: string;
  patient: {
    full_name: string;
    rut_dni: string;
    email: string;
    phone: string;
  };
  doctor: {
    full_name: string;
    specialty: string;
  };
}

export const Route = createFileRoute("/recepcion")({
  beforeLoad: async () => {
    await requireRole(["recepcion", "admin"]);
  },
  head: () => ({
    meta: [
      { title: "Módulo de Recepción — MediCita" },
      {
        name: "description",
        content:
          "Mostrador de recepción clínica para búsqueda por código de orden o RUT y confirmación de asistencia en sala de espera.",
      },
      { property: "og:title", content: "Módulo de Recepción — MediCita" },
      {
        property: "og:description",
        content: "Control de llegada y sala de espera de pacientes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceptionPage,
});

function getLocalTodayKey(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function extractOrderCode(row: Record<string, unknown>, fallbackId: string): string {
  const candidates = [
    row["order_code"],
    row["booking_code"],
    row["order_number"],
    row["reservation_code"],
    row["code"],
  ];
  for (const val of candidates) {
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim().toUpperCase();
    }
  }
  return `MC-${fallbackId.replace(/-/g, "").slice(0, 9).toUpperCase()}`;
}

function cleanRutDigits(value: string): string {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

function isAppointmentCanceled(item: { status: string; rawStatus?: string }): boolean {
  const s = item.status.toLowerCase();
  const r = (item.rawStatus ?? "").toLowerCase();
  return (
    s === "cancelled" ||
    s === "canceled" ||
    s === "cancelada" ||
    r === "cancelled" ||
    r === "canceled" ||
    r === "cancelada"
  );
}

function matchesReceptionQuery(item: ReceptionAppointmentItem, rawQuery: string): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;

  const upperQuery = trimmed.toUpperCase();
  const normalizedOrder = item.orderCode.toUpperCase();

  // Coincidencia por código de orden médica (ej. MC-43UWOZ4BQ) o ID
  if (
    normalizedOrder === upperQuery ||
    normalizedOrder.includes(upperQuery) ||
    item.id.toUpperCase().startsWith(upperQuery)
  ) {
    return true;
  }

  // Coincidencia por RUT del paciente (con o sin puntos/guión, ej. 21.605.845-3)
  const patientRutRaw = item.patient.rut_dni.trim();
  if (patientRutRaw.toUpperCase().includes(upperQuery)) {
    return true;
  }

  const queryRutDigits = cleanRutDigits(trimmed);
  const patientRutDigits = cleanRutDigits(patientRutRaw);
  if (queryRutDigits.length >= 4 && patientRutDigits.includes(queryRutDigits)) {
    return true;
  }

  if (
    normalizeRut(patientRutRaw).toUpperCase() === normalizeRut(trimmed).toUpperCase() &&
    queryRutDigits.length > 0
  ) {
    return true;
  }

  return false;
}

/**
 * Ordena las citas priorizando:
 * 1. Citas de HOY pendientes de confirmación (!checked_in_at y no canceladas).
 * 2. Citas próximas (>= hoy) pendientes de confirmación.
 * 3. Citas de hoy o próximas con asistencia ya confirmada.
 * 4. Citas anteriores o canceladas.
 * Dentro de cada prioridad, ordena cronológicamente por fecha y hora de inicio.
 */
function sortReceptionAppointments(
  items: ReceptionAppointmentItem[],
  todayStr: string,
): ReceptionAppointmentItem[] {
  const getPriority = (item: ReceptionAppointmentItem): number => {
    const canceled = isAppointmentCanceled(item);
    const checkedIn = Boolean(item.checked_in_at);
    const isToday = item.appointment_date === todayStr;
    const isFuture = item.appointment_date > todayStr;

    if (canceled) return 5;
    if (isToday && !checkedIn) return 1;
    if (isFuture && !checkedIn) return 2;
    if ((isToday || isFuture) && checkedIn) return 3;
    return 4;
  };

  return [...items].sort((a, b) => {
    const prioA = getPriority(a);
    const prioB = getPriority(b);
    if (prioA !== prioB) return prioA - prioB;

    const dateCmp = a.appointment_date.localeCompare(b.appointment_date);
    if (dateCmp !== 0) return dateCmp;

    return a.start_time.localeCompare(b.start_time);
  });
}

function ReceptionPage() {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [optimisticCheckInMap, setOptimisticCheckInMap] = useState<Record<string, string>>({});
  const todayStr = useMemo(() => getLocalTodayKey(), []);

  const receptionQueryKey = useMemo(
    () => ["reception-appointments", submittedQuery] as const,
    [submittedQuery],
  );

  const appointmentsQuery = useQuery({
    queryKey: receptionQueryKey,
    queryFn: async (): Promise<ReceptionAppointmentItem[]> => {
      const joinedRes = await supabase
        .from("appointments")
        .select("*, patients(full_name, rut_dni, email, phone), doctors(full_name, specialty)")
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (joinedRes.error) {
        throw new Error(joinedRes.error.message);
      }

      const rows = (joinedRes.data ?? []) as unknown as Array<Record<string, unknown>>;

      const mapped: ReceptionAppointmentItem[] = rows.map((row) => {
        const rawPatient = Array.isArray(row["patients"])
          ? (row["patients"][0] as Record<string, unknown> | undefined)
          : (row["patients"] as Record<string, unknown> | null | undefined);
        const rawDoctor = Array.isArray(row["doctors"])
          ? (row["doctors"][0] as Record<string, unknown> | undefined)
          : (row["doctors"] as Record<string, unknown> | null | undefined);

        const id = typeof row["id"] === "string" ? row["id"] : "";
        const checkedInAt =
          typeof row["checked_in_at"] === "string" ? row["checked_in_at"] : null;
        const rawStatus = typeof row["status"] === "string" ? row["status"] : "confirmed";

        return {
          id,
          doctor_id: typeof row["doctor_id"] === "string" ? row["doctor_id"] : "",
          patient_id: typeof row["patient_id"] === "string" ? row["patient_id"] : "",
          appointment_date:
            typeof row["appointment_date"] === "string" ? row["appointment_date"] : "",
          start_time: typeof row["start_time"] === "string" ? row["start_time"] : "",
          end_time: typeof row["end_time"] === "string" ? row["end_time"] : "",
          modality: typeof row["modality"] === "string" ? row["modality"] : "presencial",
          status: normalizeAppointmentStatus(rawStatus),
          rawStatus,
          checked_in_at: checkedInAt,
          orderCode: extractOrderCode(row, id),
          patient: {
            full_name:
              typeof rawPatient?.["full_name"] === "string" && rawPatient["full_name"].trim()
                ? rawPatient["full_name"]
                : "Paciente registrado",
            rut_dni:
              typeof rawPatient?.["rut_dni"] === "string" && rawPatient["rut_dni"].trim()
                ? rawPatient["rut_dni"]
                : "Sin RUT",
            email: typeof rawPatient?.["email"] === "string" ? rawPatient["email"] : "",
            phone: typeof rawPatient?.["phone"] === "string" ? rawPatient["phone"] : "",
          },
          doctor: {
            full_name:
              typeof rawDoctor?.["full_name"] === "string" && rawDoctor["full_name"].trim()
                ? rawDoctor["full_name"]
                : "Profesional médico",
            specialty:
              typeof rawDoctor?.["specialty"] === "string" && rawDoctor["specialty"].trim()
                ? rawDoctor["specialty"]
                : "Medicina General",
          },
        };
      });

      if (!submittedQuery.trim()) {
        return mapped;
      }

      return mapped.filter((item) => matchesReceptionQuery(item, submittedQuery));
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (appointment: ReceptionAppointmentItem) => {
      if (isAppointmentCanceled(appointment)) {
        throw new Error("No se puede confirmar asistencia de una cita cancelada.");
      }
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .update({ checked_in_at: nowIso })
        .eq("id", appointment.id)
        .select("id, checked_in_at")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!data) {
        throw new Error("No se pudo registrar la asistencia. Verifica tus permisos de recepción.");
      }

      return {
        id: appointment.id,
        checked_in_at: data.checked_in_at ?? nowIso,
      };
    },
    onMutate: async (appointment) => {
      const optimisticIso = new Date().toISOString();
      setOptimisticCheckInMap((prev) => ({
        ...prev,
        [appointment.id]: optimisticIso,
      }));
      return { targetId: appointment.id };
    },
    onSuccess: (result) => {
      setOptimisticCheckInMap((prev) => ({
        ...prev,
        [result.id]: result.checked_in_at,
      }));
      toast.success("Asistencia confirmada. Paciente registrado en sala de espera.");
      void queryClient.invalidateQueries({ queryKey: ["reception-appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["doctor-patient-appointments"] });
    },
    onError: (err, _variables, context) => {
      if (context?.targetId) {
        setOptimisticCheckInMap((prev) => {
          const next = { ...prev };
          delete next[context.targetId];
          return next;
        });
      }
      toast.error(
        err instanceof Error ? err.message : "No pudimos confirmar la asistencia del paciente",
      );
    },
  });

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmittedQuery(inputValue.trim());
  }

  function handleClearSearch() {
    setInputValue("");
    setSubmittedQuery("");
  }

  const displayedAppointments = useMemo(() => {
    const base = (appointmentsQuery.data ?? []).map((item) => {
      const optimisticCheckIn = optimisticCheckInMap[item.id];
      return optimisticCheckIn ? { ...item, checked_in_at: optimisticCheckIn } : item;
    });
    return sortReceptionAppointments(base, todayStr);
  }, [appointmentsQuery.data, optimisticCheckInMap, todayStr]);

  return (
    <>
      <PageHeading
        eyebrow="Mostrador Clínico"
        title="Módulo de Recepción"
        description="Valida la llegada de pacientes buscando por código de orden médica o RUT y confirma su ingreso a sala de espera."
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Buscador rápido de mostrador */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <Label
                htmlFor="reception-search-input"
                className="flex items-center gap-2 text-sm font-bold text-foreground"
              >
                <Search className="size-4 text-primary" />
                Buscar cita por Código de Orden o RUT del Paciente
              </Label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reception-search-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder='Ej: "MC-43UWOZ4BQ" o RUT "21.605.845-3"'
                    className="h-11 bg-background pl-10"
                    aria-label="Código de orden médica o RUT del paciente"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button type="submit" className="h-11 flex-1 gap-2 px-6 sm:flex-initial">
                    <Search className="size-4" />
                    Buscar cita
                  </Button>
                  {(inputValue || submittedQuery) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 gap-1.5"
                      onClick={handleClearSearch}
                    >
                      <RotateCcw className="size-4" />
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Presiona{" "}
                <kbd className="rounded border px-1.5 py-0.5 font-mono text-[11px]">Enter</kbd> para
                consultar la reserva directamente en recepción. Sin filtro activo se priorizan las
                citas de hoy y pendientes de llegada.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Resultados de búsqueda */}
        {appointmentsQuery.isPending ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        ) : appointmentsQuery.isError ? (
          <Card className="border-destructive/40 bg-destructive/10 p-8 text-center">
            <h2 className="text-lg font-bold text-destructive">
              Error al consultar citas en recepción
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {appointmentsQuery.error.message}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void appointmentsQuery.refetch()}
            >
              Reintentar consulta
            </Button>
          </Card>
        ) : displayedAppointments.length === 0 ? (
          <Card className="border-dashed border-border bg-card shadow-none">
            <CardContent className="py-14 text-center">
              <ClipboardCheck className="mx-auto size-12 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-bold text-foreground">
                {submittedQuery
                  ? `No se encontraron citas para "${submittedQuery}"`
                  : "No hay citas registradas para mostrar"}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Verifica que el código de orden (ej. MC-43UWOZ4BQ) o el RUT del paciente (ej.
                21.605.845-3) esté escrito correctamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {displayedAppointments.length}{" "}
                {displayedAppointments.length === 1
                  ? "cita encontrada"
                  : "citas encontradas"}
                {submittedQuery ? ` para "${submittedQuery}"` : " (ordenadas por prioridad de hoy y llegada pendiente)"}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {displayedAppointments.map((appt) => {
                const isCancelled = isAppointmentCanceled(appt);
                const isCheckedIn = Boolean(appt.checked_in_at) && !isCancelled;
                const isCheckingInThis =
                  checkInMutation.isPending && checkInMutation.variables?.id === appt.id;
                const isToday = appt.appointment_date === todayStr;

                return (
                  <Card
                    key={appt.id}
                    className="flex flex-col justify-between border-border bg-card shadow-xs transition-all hover:border-primary/30"
                  >
                    <CardContent className="flex h-full flex-col justify-between gap-4 p-5 sm:p-6">
                      <div className="space-y-4">
                        {/* Encabezado: Código de orden y Badges de estado / asistencia */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="gap-1.5 font-mono text-xs font-semibold"
                            >
                              <Hash className="size-3.5 text-primary" />
                              {appt.orderCode}
                            </Badge>
                            {isToday && !isCancelled && (
                              <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-primary/30 text-[11px]">
                                Hoy
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {isCancelled ? (
                              <Badge
                                variant="outline"
                                className="border-destructive/30 bg-destructive/10 font-semibold text-destructive"
                              >
                                Cita Cancelada
                              </Badge>
                            ) : isCheckedIn ? (
                              <>
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-success/40 bg-success-soft font-semibold text-success"
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  Asistencia Confirmada
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  En sala de espera
                                </Badge>
                              </>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              >
                                Pendiente de llegada
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Datos del Paciente */}
                        <div className="rounded-lg border border-border/70 bg-surface-subtle p-3.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Paciente
                          </p>
                          <p className="mt-0.5 flex items-center gap-2 text-base font-bold text-foreground">
                            <UserRound className="size-4 shrink-0 text-primary" />
                            <span>{appt.patient.full_name}</span>
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <IdCard className="size-3.5 shrink-0 text-primary" />
                            <span>RUT: {appt.patient.rut_dni}</span>
                          </p>
                        </div>

                        {/* Médico asignado, especialidad y horario */}
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-start gap-2">
                            <Stethoscope className="mt-0.5 size-4 shrink-0 text-primary" />
                            <div>
                              <p className="font-bold text-foreground">{appt.doctor.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {appt.doctor.specialty}
                              </p>
                            </div>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-foreground">
                            <span className="flex items-center gap-1.5 capitalize">
                              <CalendarDays className="size-3.5 text-primary" />
                              {appt.appointment_date
                                ? format(parseISO(appt.appointment_date), "EEEE d 'de' MMMM, yyyy", {
                                    locale: es,
                                  })
                                : "Fecha por confirmar"}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock3 className="size-3.5 text-primary" />
                              {appt.start_time.slice(0, 5)} – {appt.end_time.slice(0, 5)} hrs
                            </span>
                            <span className="flex items-center gap-1">
                              {appt.modality === "telemedicina" ? (
                                <Video className="size-3.5 text-primary" />
                              ) : (
                                <MapPin className="size-3.5 text-primary" />
                              )}
                              {appt.modality === "telemedicina" ? "Telemedicina" : "Presencial"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Acción de Check-In en Sala */}
                      <div className="border-t border-border pt-4">
                        {isCancelled ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled
                            className="w-full cursor-not-allowed gap-2 bg-muted text-muted-foreground opacity-60"
                          >
                            <Ban className="size-4" />
                            Cita Cancelada
                          </Button>
                        ) : isCheckedIn ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled
                            className="w-full cursor-not-allowed gap-2 border border-success/30 bg-success-soft/70 font-semibold text-success opacity-90"
                          >
                            <CheckCircle2 className="size-4 shrink-0" />
                            <span>
                              Asistencia ya confirmada
                              {appt.checked_in_at
                                ? ` (${format(parseISO(appt.checked_in_at), "HH:mm 'hrs'", {
                                    locale: es,
                                  })})`
                                : ""}
                            </span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            className="w-full gap-2 bg-success text-success-foreground hover:bg-success/90"
                            disabled={isCheckingInThis}
                            onClick={() => checkInMutation.mutate(appt)}
                          >
                            <UserCheck className="size-4" />
                            {isCheckingInThis
                              ? "Confirmando asistencia…"
                              : "Confirmar Asistencia / En Sala"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
