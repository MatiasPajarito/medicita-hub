import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMinutes, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  MapPin,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildWeekStrip,
  clinicNow,
  getWeekMonday,
  isSlotOccupied,
  type BusySlot,
  type PublicDoctor,
} from "@/lib/booking";
import { formatFeeCLP } from "@/lib/doctor-filter";
import type { DayRule } from "@/lib/schedule";
import type { PaymentReceipt } from "@/lib/payment-demo";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { PaymentReceiptView, PaymentStep, type CheckoutSummary } from "@/components/medicita/payment-step";

export interface BookingDialogProps {
  doctor: PublicDoctor | null;
  initialDate?: string | undefined;
  initialModality?: string | undefined;
  onClose: () => void;
}

export function BookingDialog({
  doctor,
  initialDate,
  initialModality = "todas",
  onClose,
}: BookingDialogProps) {
  // Mientras se procesa el pago o se guarda la cita no se puede cerrar (X, Escape o clic fuera).
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={!!doctor}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {doctor && (
          <BookingPanel
            key={doctor.id}
            doctor={doctor}
            initialDate={initialDate}
            initialModality={initialModality}
            onClose={onClose}
            onBusyChange={setBusy}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export const BookingModal = BookingDialog;

/** Traduce los errores de Supabase/Postgres a mensajes entendibles para el paciente. */
function errorMessage(error: unknown): string {
  const info: { code?: unknown; message?: unknown } =
    error && typeof error === "object" ? (error as { code?: unknown; message?: unknown }) : {};
  const code = typeof info.code === "string" ? info.code : "";
  const message = typeof info.message === "string" ? info.message : "";
  if (code === "23P01" || code === "23505" || /exclusion constraint/i.test(message)) {
    return "Este bloque horario acaba de ser reservado por otro paciente. Por favor selecciona otro horario.";
  }
  if (code === "42501" || /row-level security/i.test(message)) {
    return "No tienes permiso para agendar esta cita. Vuelve a iniciar sesión e inténtalo de nuevo.";
  }
  // P0001: mensajes en español que lanza a propósito la validación de la base ("El bloque seleccionado no está disponible", etc.)
  if (code === "P0001" && message) return message;
  return "No pudimos confirmar la reserva. Inténtalo nuevamente.";
}

function BookingPanel({
  doctor,
  initialDate,
  initialModality,
  onClose,
  onBusyChange,
}: {
  doctor: PublicDoctor;
  initialDate?: string | undefined;
  initialModality: string;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = useMemo(() => clinicNow(), []);
  const today = format(now, "yyyy-MM-dd");

  // Compute starting week Monday and initial selected date
  const initialSetup = useMemo(() => {
    const baseDate = initialDate && initialDate >= today ? initialDate : today;
    return {
      weekStart: getWeekMonday(baseDate),
      selectedDate: baseDate,
    };
  }, [initialDate, today]);

  const [weekStart, setWeekStart] = useState(initialSetup.weekStart);
  const [selectedDate, setSelectedDate] = useState(initialSetup.selectedDate);
  const [slot, setSlot] = useState("");
  const [modality, setModality] = useState(
    initialModality === "telemedicina" ? "telemedicina" : "presencial",
  );
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"select" | "payment" | "done">("select");
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [locked, setLocked] = useState<CheckoutSummary | null>(null);
  const [paying, setPaying] = useState(false);
  // Candados contra doble clic (el estado de React llega tarde si se hace clic muy rápido).
  const savingRef = useRef(false);
  const startingRef = useRef(false);

  const busy = saving || paying;
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  const user = useQuery({
    queryKey: ["booking-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data.user;
    },
  });

  // Query doctor schedule rules & existing booked appointments from Supabase with resilient fallback
  const availability = useQuery({
    queryKey: ["booking-availability", doctor.id, weekStart],
    queryFn: async () => {
      const fromDate = today < weekStart ? today : weekStart;
      const untilDate = format(addDays(parseISO(weekStart), 60), "yyyy-MM-dd");

      let rules: DayRule[] = [];
      const busySlots: BusySlot[] = [];

      try {
        const [scheduleRes, appointmentsRes, rpcRes] = await Promise.all([
          supabase.from("doctor_schedules").select("*").eq("doctor_id", doctor.id),
          supabase
            .from("appointments")
            .select("appointment_date, start_time, end_time, status")
            .eq("doctor_id", doctor.id)
            .gte("appointment_date", fromDate)
            .lte("appointment_date", untilDate)
            .in("status", ["confirmed", "pending", "scheduled", "confirmada"]),
          // La política de seguridad solo deja leer las citas propias; esta función devuelve las horas
          // ocupadas de todos los pacientes, así no se ofrecen horarios ya tomados.
          supabase.rpc("booked_clinical_slots", {
            _doctor_id: doctor.id,
            _from: fromDate,
            _to: untilDate,
          }),
        ]);

        if (!scheduleRes.error && scheduleRes.data) {
          rules = scheduleRes.data.map((r) => ({
            day_of_week: r.day_of_week,
            is_available: r.is_available,
            start_time: r.start_time.slice(0, 5),
            end_time: r.end_time.slice(0, 5),
            has_break: Boolean(r.break_start && r.break_end),
            break_start: r.break_start?.slice(0, 5) ?? "13:00",
            break_end: r.break_end?.slice(0, 5) ?? "14:00",
            slot_duration_minutes: r.slot_duration_minutes || 30,
          }));
        }

        const seen = new Set<string>();
        const addBusy = (item: BusySlot) => {
          const key = `${item.appointment_date}|${item.start_time}|${item.end_time}`;
          if (seen.has(key)) return;
          seen.add(key);
          busySlots.push(item);
        };

        if (!appointmentsRes.error && appointmentsRes.data) {
          for (const appt of appointmentsRes.data) {
            if (appt.status !== "cancelled" && appt.status !== "cancelada") {
              addBusy({
                appointment_date: appt.appointment_date,
                start_time: appt.start_time,
                end_time: appt.end_time,
              });
            }
          }
        }

        if (!rpcRes.error && rpcRes.data) {
          for (const item of rpcRes.data) {
            addBusy({
              appointment_date: item.appointment_date,
              start_time: item.start_time,
              end_time: item.end_time,
            });
          }
        }
      } catch {
        // Fallback silently to standard schedule (09:00 to 18:00 every 30 min)
      }

      return {
        rules,
        busySlots,
        modalities: ["presencial", "telemedicina"] as const,
      };
    },
  });

  const rules = useMemo(
    () => availability.data?.rules ?? [],
    [availability.data?.rules],
  );

  const selectedDateFormatted = selectedDate;

  // Consulta directa de citas ocupadas para el doctor y la fecha seleccionada
  const dayBusyQuery = useQuery({
    queryKey: ["booking-day-busy", doctor.id, selectedDateFormatted],
    queryFn: async () => {
      const daySlots: BusySlot[] = [];
      const [ { data: busyAppointments }, rpcRes ] = await Promise.all([
        supabase
          .from("appointments")
          .select("start_time, end_time, status")
          .eq("doctor_id", doctor.id)
          .eq("appointment_date", selectedDateFormatted)
          .in("status", ["confirmed", "pending", "scheduled", "confirmada"]),
        supabase.rpc("booked_clinical_slots", {
          _doctor_id: doctor.id,
          _from: selectedDateFormatted,
          _to: selectedDateFormatted,
        }),
      ]);

      if (busyAppointments) {
        for (const appt of busyAppointments) {
          daySlots.push({
            appointment_date: selectedDateFormatted,
            start_time: appt.start_time,
            end_time: appt.end_time,
          });
        }
      }

      if (!rpcRes.error && rpcRes.data) {
        for (const item of rpcRes.data) {
          daySlots.push({
            appointment_date: item.appointment_date,
            start_time: item.start_time,
            end_time: item.end_time,
          });
        }
      }

      return daySlots;
    },
  });

  const busySlots = useMemo(() => {
    const merged: BusySlot[] = [];
    const seen = new Set<string>();
    const add = (item: BusySlot) => {
      const key = `${item.appointment_date}|${item.start_time.slice(0, 5)}|${item.end_time.slice(0, 5)}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    };
    for (const s of availability.data?.busySlots ?? []) add(s);
    for (const s of dayBusyQuery.data ?? []) add(s);
    return merged;
  }, [availability.data?.busySlots, dayBusyQuery.data]);

  const modes = availability.data?.modalities ?? ["presencial", "telemedicina"];

  const weekDays = useMemo(
    () => buildWeekStrip(weekStart, rules, busySlots, now),
    [weekStart, rules, busySlots, now],
  );

  // Keep selectedDate valid within the active week when navigating weeks or after schedule loads
  useEffect(() => {
    if (availability.isPending) return;
    const inCurrentWeek = weekDays.find((d) => d.date === selectedDate);
    if (!inCurrentWeek || inCurrentWeek.isPast || !inCurrentWeek.isAvailable) {
      const firstAvailable = weekDays.find((d) => d.isAvailable);
      if (firstAvailable && firstAvailable.date !== selectedDate) {
        setSelectedDate(firstAvailable.date);
        setSlot("");
      }
    }
  }, [availability.isPending, weekDays, selectedDate]);

  const activeDay = useMemo(
    () => weekDays.find((d) => d.date === selectedDate) ?? weekDays.find((d) => d.isAvailable) ?? weekDays[0],
    [weekDays, selectedDate],
  );

  const activeDayRule = useMemo(() => {
    if (!activeDay) return undefined;
    const dayIdx = (parseISO(activeDay.date).getDay() + 6) % 7;
    return rules.find((r) => r.day_of_week === dayIdx);
  }, [activeDay, rules]);

  // Only offer slots when the day has an active availability rule and is available
  const displayedSlots = useMemo(() => {
    if (
      !activeDay ||
      activeDay.isPast ||
      !activeDay.isAvailable ||
      !activeDayRule ||
      !activeDayRule.is_available
    ) {
      return [];
    }
    const duration = activeDay.duration || 30;
    return activeDay.slots.map((s) => {
      if (isSlotOccupied(activeDay.date, s.time, duration, busySlots)) {
        return { ...s, available: false, reason: "ocupado" as const };
      }
      return s;
    });
  }, [activeDay, activeDayRule, busySlots]);

  const availableSlotsCount = useMemo(
    () => displayedSlots.filter((s) => s.available).length,
    [displayedSlots],
  );

  // If the currently selected slot becomes unavailable after a refetch, deselect it
  useEffect(() => {
    if (!slot) return;
    const found = displayedSlots.find((s) => s.time === slot);
    if (found && !found.available) {
      setSlot("");
    }
  }, [displayedSlots, slot]);

  const weekHeaderLabel = useMemo(() => {
    const startObj = parseISO(weekStart);
    const endObj = addDays(startObj, 6);
    const startMonth = format(startObj, "MMMM yyyy", { locale: es });
    const endMonth = format(endObj, "MMMM yyyy", { locale: es });
    if (startMonth === endMonth) return startMonth;
    return `${format(startObj, "MMM", { locale: es })} – ${format(endObj, "MMM yyyy", { locale: es })}`;
  }, [weekStart]);

  function handlePrevWeek() {
    const prevMonday = format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd");
    setWeekStart(prevMonday);
    setSlot("");
  }

  function handleNextWeek() {
    const nextMonday = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");
    setWeekStart(nextMonday);
    setSlot("");
  }

  async function hasConcurrentReservation(
    dateStr: string,
    slotTime: string,
    durationMinutes: number,
  ): Promise<boolean> {
    const [{ data: busyAppointments }, rpcRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("start_time, end_time, status")
        .eq("doctor_id", doctor.id)
        .eq("appointment_date", dateStr)
        .in("status", ["confirmed", "pending", "scheduled", "confirmada"]),
      supabase.rpc("booked_clinical_slots", {
        _doctor_id: doctor.id,
        _from: dateStr,
        _to: dateStr,
      }),
    ]);

    const currentBusy: BusySlot[] = [];
    if (busyAppointments) {
      for (const appt of busyAppointments) {
        currentBusy.push({
          appointment_date: dateStr,
          start_time: appt.start_time,
          end_time: appt.end_time,
        });
      }
    }
    if (!rpcRes.error && rpcRes.data) {
      for (const item of rpcRes.data) {
        currentBusy.push({
          appointment_date: item.appointment_date,
          start_time: item.start_time,
          end_time: item.end_time,
        });
      }
    }

    return isSlotOccupied(dateStr, slotTime, durationMinutes, currentBusy);
  }

  // Paso 1 -> 2: exige sesión y pasa al pago (si la consulta es gratuita, confirma directo).
  async function startCheckout() {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      await startCheckoutInner();
    } finally {
      startingRef.current = false;
    }
  }

  async function startCheckoutInner() {
    if (!activeDay || !slot) return;
    const selectedSlotItem = displayedSlots.find((s) => s.time === slot);
    if (!selectedSlotItem?.available) {
      setSlot("");
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const currentUser = user.data ?? authData.user;
    if (!currentUser) {
      toast.error("Inicia sesión para confirmar tu cita médica.");
      onClose();
      await navigate({
        to: "/acceso",
        search: { redirect: `/medicos?doctor=${doctor.id}&date=${activeDay.date}`, mode: "login" },
      });
      return;
    }
    // La cita exige una ficha en `patients`; se verifica antes de pagar para no cobrar y luego fallar.
    const { data: patientRow } = await supabase.from("patients").select("id").eq("user_id", currentUser.id).maybeSingle();
    if (!patientRow) {
      toast.error("Completa tu ficha de paciente en Mi Perfil antes de reservar.");
      onClose();
      await navigate({ to: "/perfil" });
      return;
    }

    const duration = activeDay.duration || 30;
    const alreadyTaken = await hasConcurrentReservation(activeDay.date, slot, duration);
    if (alreadyTaken) {
      toast.error(
        "Este bloque horario acaba de ser reservado por otro paciente. Por favor selecciona otro horario.",
      );
      setSlot("");
      setStep("select");
      await Promise.all([availability.refetch(), dayBusyQuery.refetch()]);
      return;
    }

    setLocked({
      doctorName: doctor.full_name,
      specialty: doctor.specialty,
      dateLabel: format(parseISO(activeDay.date), "EEEE d 'de' MMMM", { locale: es }),
      timeLabel: `${slot} h`,
      modality,
      amount: doctor.consultation_fee,
    });
    if (doctor.consultation_fee > 0) setStep("payment");
    else await saveAppointment(null);
  }

  // Paso 2 -> 3: con el pago aprobado (simulado) se guarda la cita ya confirmada.
  async function saveAppointment(paid: PaymentReceipt | null) {
    if (!activeDay || !slot) return;
    if (savingRef.current) return;
    savingRef.current = true;

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = user.data ?? authData.user;

      if (!currentUser) {
        toast.error("Inicia sesión para confirmar tu cita médica.");
        onClose();
        await navigate({
          to: "/acceso",
          search: {
            redirect: `/medicos?doctor=${doctor.id}&date=${activeDay.date}`,
            mode: "login",
          },
        });
        return;
      }

      // patient_id es siempre patients.id (la política RLS y el trigger lo exigen); nunca auth.users.id.
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (!patient) {
        toast.error("Completa tu ficha de paciente en Mi Perfil antes de confirmar tu cita.");
        onClose();
        await navigate({ to: "/perfil" });
        return;
      }

      const duration = activeDay.duration || 30;
      const end = format(addMinutes(parseISO(`${activeDay.date}T${slot}`), duration), "HH:mm");

      // Validación Anti-Race Condition Pre-Inserción
      const alreadyTaken = await hasConcurrentReservation(activeDay.date, slot, duration);
      if (alreadyTaken) {
        toast.error(
          "Este bloque horario acaba de ser reservado por otro paciente. Por favor selecciona otro horario.",
        );
        setSlot("");
        setStep("select");
        await Promise.all([availability.refetch(), dayBusyQuery.refetch()]);
        return;
      }

      const { error } = await supabase.from("appointments").insert({
        doctor_id: doctor.id,
        patient_id: patient.id,
        appointment_date: activeDay.date,
        start_time: slot,
        end_time: end,
        modality,
        status: "confirmed",
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      await queryClient.invalidateQueries({ queryKey: ["booking-availability"] });
      await queryClient.invalidateQueries({ queryKey: ["booking-day-busy"] });

      toast.success("¡Cita agendada con éxito!");
      setReceipt(paid);
      setStep("done");
    } catch (error) {
      console.error("Error al reservar cita:", error);
      toast.error(errorMessage(error));
      setSlot("");
      setStep("select");
      await Promise.all([availability.refetch(), dayBusyQuery.refetch()]);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">{doctor.full_name}</DialogTitle>
        <DialogDescription>
          {doctor.specialty} · {formatFeeCLP(doctor.consultation_fee)} por consulta
        </DialogDescription>
      </DialogHeader>

      <div className={cn("grid gap-5 pt-2", step !== "select" && "hidden")}>
        {/* 1. Selector de Fecha en Cinta Semanal Horizontal (Inspirado en estilo Bupa) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <CalendarDays className="size-4 text-primary" />
              Selecciona un día
            </Label>
            <span className="text-xs font-semibold capitalize text-muted-foreground">
              {weekHeaderLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-full border-border/80 hover:border-primary hover:text-primary"
              aria-label="Retroceder 7 días"
              onClick={handlePrevWeek}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <div
              role="group"
              aria-label="Selector semanal de fechas"
              className="grid flex-1 grid-cols-7 gap-1 sm:gap-1.5"
            >
              {weekDays.map((day) => {
                const isDisabled = day.isPast || !day.isAvailable;
                const isSelected = activeDay?.date === day.date && !isDisabled;

                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    aria-label={`${day.dayLabel} ${day.dayNumber} de ${day.monthShort}${day.isAvailable ? ", con horas disponibles" : ", sin disponibilidad"}`}
                    onClick={() => {
                      setSelectedDate(day.date);
                      setSlot("");
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border px-1 py-2 text-center transition-all",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-clinical ring-2 ring-primary/25"
                        : !isDisabled
                          ? "border-border bg-card text-foreground hover:border-primary/60 hover:bg-clinical-soft/60 cursor-pointer"
                          : "border-border/50 bg-muted/40 text-muted-foreground opacity-45 cursor-not-allowed",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-semibold tracking-tight",
                        isSelected ? "text-primary-foreground/90" : "text-muted-foreground",
                      )}
                    >
                      {day.dayLabel}
                    </span>
                    <span className="mt-0.5 text-sm font-extrabold leading-tight sm:text-base">
                      {day.dayNumber}
                    </span>
                    {/* Indicador visual (punto/badge) si el profesional tiene horas libres ese día */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 size-1.5 rounded-full transition-opacity",
                        !isDisabled
                          ? isSelected
                            ? "bg-primary-foreground opacity-100"
                            : "bg-primary opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-full border-border/80 hover:border-primary hover:text-primary"
              aria-label="Avanzar 7 días"
              onClick={handleNextWeek}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              Día con horas disponibles
            </span>
            {activeDay && (
              <span className="font-medium capitalize text-foreground">
                {activeDay.fullLabel}
              </span>
            )}
          </div>
        </div>

        {/* 2. Cuadrícula de Bloques Horarios (Time Slots) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Clock3 className="size-4 text-primary" />
              Horarios disponibles
            </Label>
            {displayedSlots.length > 0 && (
              <Badge variant="secondary" className="bg-clinical-soft text-primary font-semibold">
                {availableSlotsCount} disponibles
              </Badge>
            )}
          </div>

          {availability.isPending || dayBusyQuery.isPending ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-full bg-muted/60"
                />
              ))}
            </div>
          ) : displayedSlots.length > 0 ? (
            <div
              role="group"
              aria-label="Bloques horarios disponibles"
              className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-4"
            >
              {displayedSlots.map((s) => {
                const isSelectedSlot = slot === s.time && s.available;
                return (
                  <button
                    key={s.time}
                    type="button"
                    disabled={!s.available}
                    aria-pressed={isSelectedSlot}
                    aria-disabled={!s.available}
                    title={
                      !s.available
                        ? s.reason === "ocupado"
                          ? "Horario ocupado"
                          : "Horario no disponible"
                        : `Seleccionar ${s.time}`
                    }
                    onClick={() => {
                      if (!s.available) return;
                      setSlot(s.time);
                    }}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-all",
                      !s.available
                        ? "opacity-40 cursor-not-allowed line-through bg-slate-900 border-slate-800 text-slate-500"
                        : isSelectedSlot
                          ? "cursor-pointer border-primary bg-primary text-primary-foreground shadow-clinical ring-2 ring-primary/30"
                          : "cursor-pointer border-primary/25 bg-clinical-soft/40 text-foreground hover:border-primary hover:bg-clinical-soft",
                    )}
                  >
                    {s.time}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {!activeDayRule || !activeDayRule.is_available || !activeDay?.isAvailable
                ? "El profesional no atiende este día"
                : "No quedan bloques disponibles en este día. Selecciona otro día en la barra semanal o avanza a la próxima semana."}
            </div>
          )}
        </div>

        {/* Modalidad de atención */}
        <div className="grid gap-2">
          <Label htmlFor="booking-modality" className="text-sm font-bold">
            Modalidad de atención
          </Label>
          <Select value={modality} onValueChange={setModality}>
            <SelectTrigger id="booking-modality" className="h-11">
              <SelectValue placeholder="Seleccionar modalidad" />
            </SelectTrigger>
            <SelectContent>
              {modes.map((m) => (
                <SelectItem key={m} value={m}>
                  <span className="flex items-center gap-2">
                    {m === "telemedicina" ? (
                      <Video className="size-4 text-primary" />
                    ) : (
                      <MapPin className="size-4 text-primary" />
                    )}
                    {m === "presencial" ? "Consulta Presencial" : "Telemedicina (Videollamada)"}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 3. Confirmación de Reserva */}
        <div className="space-y-2 pt-1">
          <Button
            type="button"
            size="lg"
            className="h-12 w-full text-base font-bold shadow-clinical"
            disabled={!slot || saving}
            onClick={() => void startCheckout()}
          >
            {doctor.consultation_fee > 0 ? (
              <CreditCard className="size-5" />
            ) : (
              <CalendarCheck className="size-5" />
            )}
            {saving
              ? "Confirmando cita…"
              : doctor.consultation_fee > 0
                ? slot
                  ? `Continuar al pago - ${slot}`
                  : "Continuar al pago"
                : slot
                  ? `Confirmar Cita - ${slot}`
                  : "Confirmar Cita"}
          </Button>

          {!user.data && !user.isPending && (
            <p className="text-center text-xs text-muted-foreground">
              ¿Aún no has iniciado sesión?{" "}
              <Link
                to="/acceso"
                search={{
                  redirect: `/medicos?doctor=${doctor.id}&date=${activeDay?.date ?? today}`,
                  mode: "login",
                }}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Inicia sesión aquí
              </Link>{" "}
              para completar tu reserva.
            </p>
          )}
        </div>
      </div>

      {step === "payment" && locked && (
        <div className="pt-2">
          <PaymentStep
            summary={locked}
            onBack={() => setStep("select")}
            onApproved={(paid) => void saveAppointment(paid)}
            busy={saving}
            onProcessingChange={setPaying}
          />
        </div>
      )}
      {step === "done" && locked && (
        <div className="pt-2">
          <PaymentReceiptView summary={locked} receipt={receipt} onClose={onClose} />
        </div>
      )}
    </>
  );
}
