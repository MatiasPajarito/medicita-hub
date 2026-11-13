import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Stethoscope,
  UserRound,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import {
  ConsultationNoteDialog,
  type ConsultationNoteRecord,
} from "@/components/medicita/consultation-note-dialog";
import { PageHeading } from "@/components/medicita/page-heading";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { normalizeAppointmentStatus } from "@/lib/appointments";
import { requireRole } from "@/lib/route-guards";
import { supabase } from "@/lib/supabase";

export interface DoctorAppointmentView {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  modality: string;
  status: "confirmed" | "scheduled" | "completed" | "cancelled";
  patient?: {
    full_name: string;
    rut_dni: string;
    email: string;
    phone: string;
    user_id?: string | undefined;
  };
}

export const Route = createFileRoute("/_authenticated/doctor/citas")({
  beforeLoad: async ({ context }) => {
    await requireRole(["doctor", "admin"], context.user.id);
  },
  head: () => ({
    meta: [
      { title: "Citas de Pacientes — Portal Médico MediCita" },
      {
        name: "description",
        content:
          "Gestiona las citas agendadas por tus pacientes, registra fichas clínicas de consulta o cancela por fuerza mayor.",
      },
      { property: "og:title", content: "Citas de Pacientes — Portal Médico MediCita" },
      {
        property: "og:description",
        content: "Panel clínico de gestión de pacientes citados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DoctorAppointmentsPage,
});

function patientInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "PA"
  );
}

type DoctorScheduleQueryData = {
  doctor: { id: string; full_name: string; specialty: string } | null;
  appointments: DoctorAppointmentView[];
  notesByAppointmentId: Record<string, ConsultationNoteRecord>;
};

function DoctorAppointmentsPage() {
  const { user } = Route.useRouteContext();
  const { doctorData } = useUserRole();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "cancelled" | "all">(
    "active",
  );
  const [cancelTarget, setCancelTarget] = useState<DoctorAppointmentView | null>(null);
  const [noteModalState, setNoteModalState] = useState<{
    appointment: DoctorAppointmentView;
    readOnly: boolean;
  } | null>(null);
  const [optimisticStatusMap, setOptimisticStatusMap] = useState<
    Record<string, "completed" | "cancelled">
  >({});
  const [localNotesMap, setLocalNotesMap] = useState<Record<string, ConsultationNoteRecord>>({});

  const queryKey = useMemo(() => ["doctor-patient-appointments", user.id] as const, [user.id]);

  const doctorScheduleQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<DoctorScheduleQueryData> => {
      const { data: doctor, error: docError } = await supabase
        .from("doctors")
        .select("id, full_name, specialty")
        .eq("user_id", user.id)
        .maybeSingle();

      if (docError) throw new Error(docError.message);
      if (!doctor) return { doctor: null, appointments: [], notesByAppointmentId: {} };

      const [joinedRes, notesRes] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, doctor_id, patient_id, appointment_date, start_time, end_time, modality, status, patients(user_id, full_name, rut_dni, email, phone)",
          )
          .eq("doctor_id", doctor.id)
          .order("appointment_date", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase.from("consultation_notes").select("*").eq("doctor_id", doctor.id),
      ]);

      const notesByAppointmentId: Record<string, ConsultationNoteRecord> = {};
      if (!notesRes.error && notesRes.data) {
        for (const note of notesRes.data) {
          notesByAppointmentId[note.appointment_id] = note;
        }
      }

      if (!joinedRes.error && joinedRes.data) {
        const mapped: DoctorAppointmentView[] = joinedRes.data.map((row) => {
          const rawPatient = Array.isArray(row.patients)
            ? (row.patients[0] ?? null)
            : row.patients;
          return {
            id: row.id,
            doctor_id: row.doctor_id,
            patient_id: row.patient_id,
            appointment_date: row.appointment_date,
            start_time: row.start_time,
            end_time: row.end_time,
            modality: row.modality,
            status: normalizeAppointmentStatus(row.status),
            ...(rawPatient
              ? {
                  patient: {
                    full_name: rawPatient.full_name,
                    rut_dni: rawPatient.rut_dni,
                    email: rawPatient.email,
                    phone: rawPatient.phone,
                    user_id: rawPatient.user_id,
                  },
                }
              : {}),
          };
        });
        return { doctor, appointments: mapped, notesByAppointmentId };
      }

      const basicRes = await supabase
        .from("appointments")
        .select("id, doctor_id, patient_id, appointment_date, start_time, end_time, modality, status")
        .eq("doctor_id", doctor.id)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (basicRes.error) throw new Error(basicRes.error.message);

      const mappedBasic: DoctorAppointmentView[] = (basicRes.data ?? []).map((row) => ({
        id: row.id,
        doctor_id: row.doctor_id,
        patient_id: row.patient_id,
        appointment_date: row.appointment_date,
        start_time: row.start_time,
        end_time: row.end_time,
        modality: row.modality,
        status: normalizeAppointmentStatus(row.status),
      }));

      return { doctor, appointments: mappedBasic, notesByAppointmentId };
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      appointment,
      nextStatus,
    }: {
      appointment: DoctorAppointmentView;
      nextStatus: "completed" | "cancelled";
    }) => {
      const { data, error } = await supabase
        .from("appointments")
        .update({ status: nextStatus })
        .eq("id", appointment.id)
        .eq("doctor_id", appointment.doctor_id)
        .select("id, status")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error("No se pudo actualizar el estado de la cita. Verifica tus permisos.");
      }
      return { id: appointment.id, status: nextStatus };
    },
    onMutate: async ({ appointment, nextStatus }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DoctorScheduleQueryData>(queryKey);

      setOptimisticStatusMap((prev) => ({ ...prev, [appointment.id]: nextStatus }));
      queryClient.setQueryData<DoctorScheduleQueryData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          appointments: old.appointments.map((item) =>
            item.id === appointment.id ? { ...item, status: nextStatus } : item,
          ),
        };
      });
      setCancelTarget(null);

      return { previous, targetId: appointment.id };
    },
    onSuccess: (result) => {
      queryClient.setQueryData<DoctorScheduleQueryData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          appointments: old.appointments.map((item) =>
            item.id === result.id ? { ...item, status: result.status } : item,
          ),
        };
      });
      if (result.status === "completed") {
        toast.success("Cita marcada como atendida");
      } else {
        toast.success("Cita cancelada por fuerza mayor");
      }
      void queryClient.invalidateQueries({ queryKey: ["doctor-patient-appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["doctor-dashboard-metrics"] });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-availability"] });
    },
    onError: (err, _variables, context) => {
      if (context?.targetId) {
        setOptimisticStatusMap((prev) => {
          const next = { ...prev };
          delete next[context.targetId];
          return next;
        });
      }
      if (context?.previous) {
        queryClient.setQueryData<DoctorScheduleQueryData>(queryKey, context.previous);
      }
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar la cita");
    },
  });

  const notesByAppointmentId = useMemo(
    () => ({
      ...(doctorScheduleQuery.data?.notesByAppointmentId ?? {}),
      ...localNotesMap,
    }),
    [doctorScheduleQuery.data?.notesByAppointmentId, localNotesMap],
  );

  const appointments = useMemo(() => {
    const list = doctorScheduleQuery.data?.appointments ?? [];
    return list.map((appt) => {
      const optimistic = optimisticStatusMap[appt.id];
      return optimistic ? { ...appt, status: optimistic } : appt;
    });
  }, [doctorScheduleQuery.data?.appointments, optimisticStatusMap]);

  const grouped = useMemo(() => {
    const active = appointments.filter(
      (a) => a.status === "confirmed" || a.status === "scheduled",
    );
    const completed = appointments.filter((a) => a.status === "completed");
    const cancelled = appointments.filter((a) => a.status === "cancelled");
    return { active, completed, cancelled, all: appointments };
  }, [appointments]);

  const doctorInfo = doctorScheduleQuery.data?.doctor;
  const resolvedDoctorId = doctorData?.id ?? doctorInfo?.id ?? null;

  return (
    <>
      <PageHeading
        eyebrow="Portal Médico"
        title="Citas de Pacientes"
        description={
          doctorInfo
            ? `${doctorInfo.full_name} · ${doctorInfo.specialty}`
            : "Revisa y gestiona las consultas médicas agendadas por tus pacientes."
        }
        action={
          <Button asChild variant="outline">
            <Link to="/doctor/disponibilidad">
              <CalendarClock className="size-4" />
              Configurar disponibilidad
            </Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 transition-opacity duration-300 sm:px-6 lg:px-8">
        {doctorScheduleQuery.isPending ? (
          <div className="space-y-6 transition-opacity duration-300">
            <Skeleton className="h-10 w-80 max-w-full" />
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-56 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : doctorScheduleQuery.isError ? (
          <Card className="border-destructive/40 bg-destructive/10 p-8 text-center animate-in fade-in duration-300">
            <h2 className="text-lg font-bold text-destructive">
              No pudimos cargar la agenda de pacientes
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {doctorScheduleQuery.error.message}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void doctorScheduleQuery.refetch()}
            >
              Reintentar
            </Button>
          </Card>
        ) : !doctorInfo ? (
          <Card className="shadow-none animate-in fade-in duration-300">
            <CardContent className="py-12 text-center">
              <Stethoscope className="mx-auto size-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-bold">Perfil médico pendiente de vinculación</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Tu usuario tiene rol profesional, pero aún no está asociado a un registro en el
                directorio de médicos. Solicita a un administrador vincular tu cuenta.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="animate-in fade-in duration-300">
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <Card className="border-border/80 shadow-xs transition-all duration-300">
                <CardContent className="flex items-center justify-between p-4 sm:p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Citas por atender
                    </p>
                    <p className="mt-1 text-2xl font-extrabold text-primary">
                      {grouped.active.length}
                    </p>
                  </div>
                  <span className="flex size-11 items-center justify-center rounded-lg bg-clinical-soft text-primary">
                    <CalendarDays className="size-5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-border/80 shadow-xs transition-all duration-300">
                <CardContent className="flex items-center justify-between p-4 sm:p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Atenciones realizadas
                    </p>
                    <p className="mt-1 text-2xl font-extrabold text-success">
                      {grouped.completed.length}
                    </p>
                  </div>
                  <span className="flex size-11 items-center justify-center rounded-lg bg-success-soft text-success">
                    <CheckCircle2 className="size-5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-border/80 shadow-xs transition-all duration-300">
                <CardContent className="flex items-center justify-between p-4 sm:p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Canceladas
                    </p>
                    <p className="mt-1 text-2xl font-extrabold text-muted-foreground">
                      {grouped.cancelled.length}
                    </p>
                  </div>
                  <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <CalendarX2 className="size-5" />
                  </span>
                </CardContent>
              </Card>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as "active" | "completed" | "cancelled" | "all")
              }
            >
              <TabsList className="mb-6 h-auto w-full flex-wrap sm:w-auto">
                <TabsTrigger value="active" className="min-h-10 flex-1 gap-2">
                  Por atender
                  <span className="text-xs text-muted-foreground">{grouped.active.length}</span>
                </TabsTrigger>
                <TabsTrigger value="completed" className="min-h-10 flex-1 gap-2">
                  Atendidas
                  <span className="text-xs text-muted-foreground">{grouped.completed.length}</span>
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="min-h-10 flex-1 gap-2">
                  Canceladas
                  <span className="text-xs text-muted-foreground">{grouped.cancelled.length}</span>
                </TabsTrigger>
                <TabsTrigger value="all" className="min-h-10 flex-1 gap-2">
                  Todas
                  <span className="text-xs text-muted-foreground">{grouped.all.length}</span>
                </TabsTrigger>
              </TabsList>

              {(["active", "completed", "cancelled", "all"] as const).map((tabKey) => {
                const list = grouped[tabKey];
                return (
                  <TabsContent
                    key={tabKey}
                    value={tabKey}
                    className="transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-2"
                  >
                    {list.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border py-16 text-center animate-in fade-in-50 duration-300">
                        <CalendarX2 className="mx-auto size-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-bold">
                          No hay citas en esta categoría
                        </h3>
                        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                          Las reservas que los pacientes agenden contigo aparecerán automáticamente
                          en este panel.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {list.map((appt, index) => {
                          const existingNote = notesByAppointmentId[appt.id] ?? null;
                          return (
                            <DoctorAppointmentCard
                              key={appt.id}
                              appointment={appt}
                              existingNote={existingNote}
                              index={index}
                              isUpdating={
                                updateStatusMutation.isPending &&
                                updateStatusMutation.variables?.appointment.id === appt.id
                              }
                              onAttendOrRegisterNote={() =>
                                setNoteModalState({
                                  appointment: appt,
                                  readOnly: Boolean(existingNote),
                                })
                              }
                              onViewNote={() =>
                                setNoteModalState({
                                  appointment: appt,
                                  readOnly: true,
                                })
                              }
                              onRequestCancel={() => setCancelTarget(appt)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        )}
      </div>

      <ConsultationNoteDialog
        appointment={noteModalState?.appointment ?? null}
        doctorId={resolvedDoctorId}
        existingNote={
          noteModalState ? (notesByAppointmentId[noteModalState.appointment.id] ?? null) : null
        }
        readOnly={noteModalState?.readOnly ?? false}
        onClose={() => setNoteModalState(null)}
        onSuccess={({ appointmentId, note }) => {
          setOptimisticStatusMap((prev) => ({ ...prev, [appointmentId]: "completed" }));
          setLocalNotesMap((prev) => ({ ...prev, [appointmentId]: note }));
        }}
      />

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !updateStatusMutation.isPending) setCancelTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Cancelar cita por fuerza mayor
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmas la cancelación por fuerza mayor de la cita con{" "}
              <strong>{cancelTarget?.patient?.full_name ?? "el paciente"}</strong>? El bloque
              horario quedará actualizado como cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatusMutation.isPending}>
              Volver
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={updateStatusMutation.isPending}
              onClick={() => {
                if (cancelTarget) {
                  updateStatusMutation.mutate({
                    appointment: cancelTarget,
                    nextStatus: "cancelled",
                  });
                }
              }}
            >
              {updateStatusMutation.isPending
                ? "Cancelando…"
                : "Confirmar cancelación por fuerza mayor"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DoctorAppointmentCard({
  appointment,
  existingNote,
  index = 0,
  isUpdating,
  onAttendOrRegisterNote,
  onViewNote,
  onRequestCancel,
}: {
  appointment: DoctorAppointmentView;
  existingNote: ConsultationNoteRecord | null;
  index?: number;
  isUpdating: boolean;
  onAttendOrRegisterNote: () => void;
  onViewNote: () => void;
  onRequestCancel: () => void;
}) {
  const patient = appointment.patient;
  const patientName = patient?.full_name ?? "Paciente agendado";
  const telemedicine = appointment.modality === "telemedicina";
  const isActive = appointment.status === "confirmed" || appointment.status === "scheduled";
  const isCompleted = appointment.status === "completed";

  const statusBadge =
    appointment.status === "completed"
      ? {
          label: "Atendida",
          className: "border-success/30 bg-success-soft text-success",
        }
      : appointment.status === "cancelled"
        ? {
            label: "Cancelada",
            className: "border-destructive/30 bg-destructive/10 text-destructive",
          }
        : {
            label: "Confirmada",
            className: "border-primary/30 bg-clinical-soft text-primary",
          };

  return (
    <article
      style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
      className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xs transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-2 fill-mode-both hover:border-primary/30 hover:shadow-clinical sm:p-6"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Avatar className="size-12 shrink-0">
              <AvatarFallback className="bg-clinical-soft font-bold text-primary">
                {patientInitials(patientName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-lg font-bold text-foreground">{patientName}</h2>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <IdCard className="size-3.5 text-primary" />
                RUT: {patient?.rut_dni ?? "No especificado"}
              </p>
            </div>
          </div>

          <Badge variant="outline" className={statusBadge.className}>
            {statusBadge.label}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 py-1">
            {telemedicine ? (
              <Video className="size-3.5 text-primary" />
            ) : (
              <MapPin className="size-3.5 text-primary" />
            )}
            {telemedicine ? "Telemedicina" : "Presencial"}
          </Badge>

          {existingNote && (
            <Badge
              variant="secondary"
              className="gap-1.5 border border-primary/20 bg-clinical-soft/70 py-1 text-primary"
            >
              <FileText className="size-3.5" />
              Ficha clínica registrada
            </Badge>
          )}
        </div>

        <div className="mt-4 grid gap-2 rounded-lg bg-surface-subtle p-3.5 text-sm">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            <span className="capitalize">
              {format(parseISO(appointment.appointment_date), "EEEE d 'de' MMMM, yyyy", {
                locale: es,
              })}
            </span>
          </p>
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Clock3 className="size-4 shrink-0 text-primary" />
            {appointment.start_time.slice(0, 5)} – {appointment.end_time.slice(0, 5)} hrs
          </p>

          {(patient?.phone || patient?.email) && (
            <div className="mt-1 border-t border-border/60 pt-2 text-xs text-muted-foreground space-y-1">
              {patient.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="size-3.5 text-primary" />
                  <span>{patient.phone}</span>
                </p>
              )}
              {patient.email && (
                <p className="flex items-center gap-2">
                  <Mail className="size-3.5 text-primary" />
                  <span className="truncate">{patient.email}</span>
                </p>
              )}
            </div>
          )}
          {!patient && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserRound className="size-3.5 text-primary" />
              ID Paciente: {appointment.patient_id.slice(0, 8)}…
            </p>
          )}
        </div>
      </div>

      {isActive && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-border pt-4">
          {telemedicine && (
            <Button
              asChild
              size="sm"
              className="min-h-10 w-full gap-1.5 font-semibold"
            >
              <Link
                to="/videoconsulta/$appointmentId"
                params={{ appointmentId: appointment.id }}
              >
                <Video className="size-4" aria-hidden="true" />
                Iniciar videoconsulta
              </Link>
            </Button>
          )}
          {existingNote ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5 border-primary/40 text-primary hover:bg-clinical-soft"
              onClick={onViewNote}
            >
              <FileText className="size-4" />
              Ver Ficha Clínica
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="flex-1 gap-1.5 bg-success text-success-foreground hover:bg-success/90"
              disabled={isUpdating}
              onClick={onAttendOrRegisterNote}
            >
              <ClipboardList className="size-4" />
              Atender / Registrar Ficha
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isUpdating}
            onClick={onRequestCancel}
          >
            <AlertTriangle className="size-4" />
            Cancelar por fuerza mayor
          </Button>
        </div>
      )}

      {isCompleted && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-border pt-4">
          {existingNote ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-1.5 border-primary/40 text-primary hover:bg-clinical-soft"
              onClick={onViewNote}
            >
              <FileText className="size-4" />
              Ver Ficha Clínica (Solo lectura)
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={onAttendOrRegisterNote}
            >
              <ClipboardList className="size-4" />
              Registrar Ficha Clínica
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
