import { useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  Link,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  Clock3,
  MapPin,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "@/components/medicita/page-heading";
import { RescheduleDialog } from "@/components/medicita/reschedule-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  appointmentStatus,
  cancelPatientAppointment,
  canModifyWithMinimumNotice,
  groupAppointments,
  MIN_NOTICE_MESSAGE,
  normalizeAppointmentStatus,
  patientAppointmentsQuery,
  type Appointment,
} from "@/lib/appointments";
import { clinicNow } from "@/lib/booking";

export interface AppointmentView {
  id: string;
  doctor_id: string;
  patient_id?: string | undefined;
  appointment_date: string;
  start_time: string;
  end_time: string;
  modality: string;
  status: "confirmed" | "scheduled" | "completed" | "cancelled";
  doctor?: {
    full_name: string;
    specialty: string;
  };
}

export const Route = createFileRoute("/_authenticated/mi-agenda")({
  validateSearch: (search: Record<string, unknown>): { tab: "upcoming" | "history" } => ({
    tab: search["tab"] === "history" ? "history" : "upcoming",
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(patientAppointmentsQuery(context.user.id));
  },
  pendingMs: 0,
  pendingComponent: AgendaSkeleton,
  errorComponent: AgendaError,
  notFoundComponent: () => <EmptyAgenda history={false} />,
  head: () => ({
    meta: [
      { title: "Mi agenda — MediCita" },
      {
        name: "description",
        content:
          "Revisa tus citas médicas agendadas, consulta tu historial y gestiona tus atenciones en MediCita.",
      },
      { property: "og:title", content: "Mi agenda — MediCita" },
      {
        property: "og:description",
        content: "Tus próximas atenciones e historial clínico en un solo lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MySchedule,
});

function Heading() {
  return (
    <PageHeading
      eyebrow="Área de pacientes"
      title="Mi agenda"
      description="Revisa tus citas médicas agendadas y gestiona tus atenciones"
      action={
        <Button asChild>
          <Link to="/medicos">
            <CalendarDays />
            Agendar nueva cita
          </Link>
        </Button>
      }
    />
  );
}

function AgendaSkeleton() {
  return (
    <>
      <Heading />
      <div
        role="status"
        aria-label="Cargando citas"
        className="mx-auto max-w-7xl space-y-6 px-4 py-8 transition-opacity duration-300 sm:px-6 lg:px-8"
      >
        <Skeleton className="h-10 w-72 max-w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </>
  );
}

function AgendaError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <>
      <Heading />
      <div
        role="alert"
        className="mx-auto max-w-7xl px-4 py-16 text-center animate-in fade-in duration-300"
      >
        <h2 className="text-xl font-bold">No pudimos cargar tus citas</h2>
        <p className="mt-2 break-words text-muted-foreground">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={async () => {
            await queryClient.resetQueries({ queryKey: ["appointments"] });
            await router.invalidate();
          }}
        >
          Reintentar
        </Button>
      </div>
    </>
  );
}

function EmptyAgenda({ history }: { history: boolean }) {
  return (
    <div className="py-16 text-center animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      <CalendarX2 className="mx-auto size-12 text-muted-foreground" />
      <h2 className="mt-4 text-xl font-bold">
        {history ? "Aún no tienes citas en tu historial" : "Aún no tienes citas agendadas"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">
        {history
          ? "Tus atenciones anteriores y citas canceladas aparecerán aquí."
          : "Encuentra al profesional que necesitas y reserva tu próxima atención médica."}
      </p>
      <Button asChild className="mt-6">
        <Link to="/medicos">
          <CalendarDays />
          Buscar horas disponibles
        </Link>
      </Button>
    </div>
  );
}

function toAppointmentView(raw: Appointment): AppointmentView {
  const rawDoctor = raw.doctor ?? raw.doctors;
  return {
    id: raw.id,
    doctor_id: raw.doctor_id,
    patient_id: raw.patient_id,
    appointment_date: raw.appointment_date,
    start_time: raw.start_time,
    end_time: raw.end_time,
    modality: raw.modality,
    status: normalizeAppointmentStatus(raw.status),
    ...(rawDoctor
      ? {
          doctor: {
            full_name: rawDoctor.full_name,
            specialty: rawDoctor.specialty,
          },
        }
      : {}),
  };
}

function MySchedule() {
  const { user } = Route.useRouteContext();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const queryOptions = patientAppointmentsQuery(user.id);
  const { data } = useSuspenseQuery(queryOptions);
  const [selection, setSelection] = useState<AppointmentView | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentView | null>(null);
  const [optimisticCancelledIds, setOptimisticCancelledIds] = useState<Record<string, boolean>>(
    {},
  );
  const [optimisticRescheduledMap, setOptimisticRescheduledMap] = useState<
    Record<string, { appointment_date: string; start_time: string; end_time: string }>
  >({});
  const [now, setNow] = useState(clinicNow);

  useEffect(() => {
    const timer = setInterval(() => setNow(clinicNow()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const appointments = useMemo<AppointmentView[]>(
    () =>
      (data ?? []).map((raw) => {
        let view = toAppointmentView(raw);
        const rescheduled = optimisticRescheduledMap[view.id];
        if (rescheduled) {
          view = {
            ...view,
            appointment_date: rescheduled.appointment_date,
            start_time: rescheduled.start_time,
            end_time: rescheduled.end_time,
          };
        }
        if (optimisticCancelledIds[view.id]) {
          view = { ...view, status: "cancelled" };
        }
        return view;
      }),
    [data, optimisticCancelledIds, optimisticRescheduledMap],
  );

  const { upcoming, history } = groupAppointments(appointments, now);

  const cancellation = useMutation({
    mutationFn: (appointment: AppointmentView) => cancelPatientAppointment(appointment, user.id, now),
    onMutate: async (appointment) => {
      await queryClient.cancelQueries({ queryKey: queryOptions.queryKey });
      const previous = queryClient.getQueryData<Appointment[]>(queryOptions.queryKey);

      setOptimisticCancelledIds((prev) => ({ ...prev, [appointment.id]: true }));
      queryClient.setQueryData<Appointment[]>(queryOptions.queryKey, (old) =>
        old?.map((a) => (a.id === appointment.id ? { ...a, status: "cancelled" } : a)),
      );
      setSelection(null);

      return { previous, cancelledId: appointment.id };
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Appointment[]>(queryOptions.queryKey, (old) =>
        old?.map((a) => (a.id === result.id ? { ...a, status: result.status } : a)),
      );
      toast.success("Cita cancelada correctamente");
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-availability"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-day-busy"] });
    },
    onError: (error, _variables, context) => {
      if (context?.cancelledId) {
        setOptimisticCancelledIds((prev) => {
          const next = { ...prev };
          delete next[context.cancelledId];
          return next;
        });
      }
      if (context?.previous) {
        queryClient.setQueryData<Appointment[]>(queryOptions.queryKey, context.previous);
      }
      console.error("Error al cancelar cita:", error);
      toast.error(error.message);
    },
  });

  function handleRescheduledSuccess(updated: {
    id: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
  }) {
    setOptimisticRescheduledMap((prev) => ({
      ...prev,
      [updated.id]: {
        appointment_date: updated.appointment_date,
        start_time: updated.start_time,
        end_time: updated.end_time,
      },
    }));
    queryClient.setQueryData<Appointment[]>(queryOptions.queryKey, (old) =>
      old?.map((a) =>
        a.id === updated.id
          ? {
              ...a,
              appointment_date: updated.appointment_date,
              start_time: updated.start_time,
              end_time: updated.end_time,
            }
          : a,
      ),
    );
  }

  return (
    <>
      <Heading />
      <div className="mx-auto max-w-7xl px-4 py-8 transition-opacity duration-300 sm:px-6 lg:px-8">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            void navigate({ search: { tab: value === "history" ? "history" : "upcoming" } });
          }}
        >
          <TabsList className="mb-6 h-auto w-full sm:w-auto">
            <TabsTrigger value="upcoming" className="min-h-10 flex-1 gap-2">
              Próximas citas
              <span className="text-xs text-muted-foreground">{upcoming.length}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="min-h-10 flex-1 gap-2">
              Historial y canceladas
              <span className="text-xs text-muted-foreground">{history.length}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="upcoming"
            className="transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-2"
          >
            {upcoming.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {upcoming.map((a, index) => (
                  <AppointmentCard
                    key={a.id}
                    appointment={a}
                    index={index}
                    now={now}
                    onCancel={() => setSelection(a)}
                    onReschedule={() => setRescheduleTarget(a)}
                  />
                ))}
              </div>
            ) : (
              <EmptyAgenda history={false} />
            )}
          </TabsContent>
          <TabsContent
            value="history"
            className="transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-2"
          >
            {history.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {history.map((a, index) => (
                  <AppointmentCard key={a.id} appointment={a} index={index} now={now} />
                ))}
              </div>
            ) : (
              <EmptyAgenda history />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={selection !== null}
        onOpenChange={(open) => {
          if (!open && !cancellation.isPending) setSelection(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar cita</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas cancelar esta cita? Esta acción liberará el horario
              seleccionado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancellation.isPending}>Mantener cita</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={cancellation.isPending}
              onClick={() => {
                if (selection) cancellation.mutate(selection);
              }}
            >
              {cancellation.isPending ? "Cancelando…" : "Sí, cancelar cita"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RescheduleDialog
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={handleRescheduledSuccess}
      />
    </>
  );
}

function AppointmentCard({
  appointment,
  index = 0,
  now,
  onCancel,
  onReschedule,
}: {
  appointment: AppointmentView;
  index?: number;
  now: Date;
  onCancel?: () => void;
  onReschedule?: () => void;
}) {
  const doctor = appointment.doctor;
  const name = doctor?.full_name ?? "Profesional médico";
  const initials = name
    .replace(/^dra?\.?\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
  const status = appointmentStatus(appointment, now);
  const telemedicine = appointment.modality === "telemedicina";
  const hasActions = Boolean(onCancel || onReschedule);
  const canModify = canModifyWithMinimumNotice(appointment, now);

  return (
    <article
      style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
      className="min-w-0 rounded-lg border border-border bg-card p-5 text-card-foreground transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-2 fill-mode-both hover:border-primary/30 hover:shadow-clinical sm:p-6"
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-12 shrink-0">
          <AvatarFallback className="bg-clinical-soft font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-bold">{name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {doctor?.specialty ?? "Atención médica"}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1.5 py-1">
          {telemedicine ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
          {telemedicine ? "Telemedicina" : "Presencial"}
        </Badge>
        <Badge
          variant="outline"
          className={
            status.tone === "confirmed"
              ? "border-success/30 bg-success-soft text-success"
              : status.tone === "cancelled"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-muted text-muted-foreground"
          }
        >
          {status.label}
        </Badge>
      </div>
      <div className="mt-5 space-y-2 text-sm">
        <p className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="capitalize">
            {format(parseISO(appointment.appointment_date), "EEEE d 'de' MMMM, yyyy", {
              locale: es,
            })}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <Clock3 className="size-4 text-primary" />
          {appointment.start_time.slice(0, 5)} – {appointment.end_time.slice(0, 5)}
        </p>
      </div>
      {hasActions && (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          {!canModify && (
            <div
              role="note"
              className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{MIN_NOTICE_MESSAGE}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {onReschedule && (
              <span
                title={!canModify ? MIN_NOTICE_MESSAGE : "Reagendar esta cita"}
                className="w-full sm:w-auto"
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canModify}
                  onClick={() => {
                    if (canModify) onReschedule();
                  }}
                  className="w-full gap-1.5 border-primary/30 text-primary transition-colors hover:bg-clinical-soft hover:text-primary disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                >
                  <CalendarClock className="size-4" />
                  Reagendar
                </Button>
              </span>
            )}
            {onCancel && (
              <span
                title={!canModify ? MIN_NOTICE_MESSAGE : "Cancelar esta cita"}
                className="w-full sm:w-auto"
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canModify}
                  onClick={() => {
                    if (canModify) onCancel();
                  }}
                  className="w-full gap-1.5 border-destructive/30 text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                >
                  <X className="size-4" />
                  Cancelar Cita
                </Button>
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
