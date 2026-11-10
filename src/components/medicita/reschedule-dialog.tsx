import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMinutes, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Stethoscope,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canModifyWithMinimumNotice, MIN_NOTICE_MESSAGE } from "@/lib/appointments";
import {
  bookingDaySlots,
  buildWeekStrip,
  clinicNow,
  defaultWeeklyRules,
  generateFallbackSlots,
  getWeekMonday,
  isSlotOccupied,
  type BusySlot,
} from "@/lib/booking";
import type { DayRule } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export interface RescheduleTarget {
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

export interface RescheduleDialogProps {
  appointment: RescheduleTarget | null;
  onClose: () => void;
  onRescheduled?: (updated: {
    id: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
  }) => void;
}

function translateRescheduleError(error: unknown): string {
  const info: { code?: unknown; message?: unknown } =
    error && typeof error === "object" ? (error as { code?: unknown; message?: unknown }) : {};
  const code = typeof info.code === "string" ? info.code : "";
  const message = typeof info.message === "string" ? info.message : "";
  if (code === "23P01" || code === "23505" || /exclusion constraint/i.test(message)) {
    return "Este bloque horario acaba de ser reservado por otro paciente. Por favor selecciona otro horario.";
  }
  if (/2 horas|anticipación|notice/i.test(message)) {
    return MIN_NOTICE_MESSAGE;
  }
  if (code === "P0001" && message) return message;
  return message || "No pudimos reagendar tu cita. Inténtalo nuevamente.";
}

export function RescheduleDialog({
  appointment,
  onClose,
  onRescheduled,
}: RescheduleDialogProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={Boolean(appointment)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {appointment && (
          <ReschedulePanel
            key={appointment.id}
            appointment={appointment}
            onClose={onClose}
            onBusyChange={setBusy}
            onRescheduled={onRescheduled}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReschedulePanel({
  appointment,
  onClose,
  onBusyChange,
  onRescheduled,
}: {
  appointment: RescheduleTarget;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  onRescheduled?:
    | ((updated: {
        id: string;
        appointment_date: string;
        start_time: string;
        end_time: string;
      }) => void)
    | undefined;
}) {
  const queryClient = useQueryClient();
  const now = useMemo(() => clinicNow(), []);
  const today = format(now, "yyyy-MM-dd");

  const initialDate =
    appointment.appointment_date >= today ? appointment.appointment_date : today;
  const [weekStart, setWeekStart] = useState(() => getWeekMonday(initialDate));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [slot, setSlot] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    onBusyChange(saving);
  }, [saving, onBusyChange]);

  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  const doctorName = appointment.doctor?.full_name ?? "Profesional médico";
  const doctorSpecialty = appointment.doctor?.specialty ?? "Atención médica";
  const currentStartShort = appointment.start_time.slice(0, 5);
  const currentEndShort = appointment.end_time.slice(0, 5);

  const availability = useQuery({
    queryKey: ["reschedule-availability", appointment.doctor_id, weekStart, appointment.id],
    queryFn: async () => {
      const fromDate = today < weekStart ? today : weekStart;
      const untilDate = format(addDays(parseISO(weekStart), 60), "yyyy-MM-dd");

      let rules: DayRule[] = defaultWeeklyRules();
      const busySlots: BusySlot[] = [];

      try {
        const [scheduleRes, appointmentsRes, rpcRes] = await Promise.all([
          supabase
            .from("doctor_schedules")
            .select("*")
            .eq("doctor_id", appointment.doctor_id),
          supabase
            .from("appointments")
            .select("id, appointment_date, start_time, end_time, status")
            .eq("doctor_id", appointment.doctor_id)
            .gte("appointment_date", fromDate)
            .lte("appointment_date", untilDate)
            .in("status", ["confirmed", "pending", "scheduled", "confirmada"]),
          supabase.rpc("booked_clinical_slots", {
            _doctor_id: appointment.doctor_id,
            _from: fromDate,
            _to: untilDate,
          }),
        ]);

        if (!scheduleRes.error && scheduleRes.data && scheduleRes.data.length > 0) {
          const mappedRules: DayRule[] = scheduleRes.data.map((r) => ({
            day_of_week: r.day_of_week,
            is_available: r.is_available,
            start_time: r.start_time.slice(0, 5),
            end_time: r.end_time.slice(0, 5),
            has_break: Boolean(r.break_start && r.break_end),
            break_start: r.break_start?.slice(0, 5) ?? "13:00",
            break_end: r.break_end?.slice(0, 5) ?? "14:00",
            slot_duration_minutes: r.slot_duration_minutes || 30,
          }));
          if (mappedRules.some((r) => r.is_available)) {
            rules = mappedRules;
          }
        }

        const seen = new Set<string>();
        const addBusy = (item: BusySlot) => {
          const isCurrentAppointmentSlot =
            item.appointment_date === appointment.appointment_date &&
            item.start_time.slice(0, 5) === currentStartShort;
          if (isCurrentAppointmentSlot) return;

          const key = `${item.appointment_date}|${item.start_time.slice(0, 5)}|${item.end_time.slice(0, 5)}`;
          if (seen.has(key)) return;
          seen.add(key);
          busySlots.push(item);
        };

        if (!appointmentsRes.error && appointmentsRes.data) {
          for (const appt of appointmentsRes.data) {
            if (appt.id === appointment.id) continue;
            addBusy({
              appointment_date: appt.appointment_date,
              start_time: appt.start_time,
              end_time: appt.end_time,
            });
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
        // Fallback to standard weekly schedule
      }

      return { rules, busySlots };
    },
  });

  const dayBusyQuery = useQuery({
    queryKey: ["reschedule-day-busy", appointment.doctor_id, selectedDate, appointment.id],
    queryFn: async () => {
      const daySlots: BusySlot[] = [];
      const [{ data: busyAppointments }, rpcRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, start_time, end_time, status")
          .eq("doctor_id", appointment.doctor_id)
          .eq("appointment_date", selectedDate)
          .in("status", ["confirmed", "pending", "scheduled", "confirmada"]),
        supabase.rpc("booked_clinical_slots", {
          _doctor_id: appointment.doctor_id,
          _from: selectedDate,
          _to: selectedDate,
        }),
      ]);

      if (busyAppointments) {
        for (const appt of busyAppointments) {
          if (appt.id === appointment.id) continue;
          daySlots.push({
            appointment_date: selectedDate,
            start_time: appt.start_time,
            end_time: appt.end_time,
          });
        }
      }

      if (!rpcRes.error && rpcRes.data) {
        for (const item of rpcRes.data) {
          const isCurrentAppointmentSlot =
            item.appointment_date === appointment.appointment_date &&
            item.start_time.slice(0, 5) === currentStartShort;
          if (isCurrentAppointmentSlot) continue;
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

  const rules = useMemo(
    () => availability.data?.rules ?? defaultWeeklyRules(),
    [availability.data?.rules],
  );

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

  const weekDays = useMemo(
    () => buildWeekStrip(weekStart, rules, busySlots, now),
    [weekStart, rules, busySlots, now],
  );

  const activeDay = useMemo(
    () =>
      weekDays.find((d) => d.date === selectedDate) ??
      weekDays.find((d) => d.isAvailable) ??
      weekDays[0],
    [weekDays, selectedDate],
  );

  const displayedSlots = useMemo(() => {
    if (!activeDay || activeDay.isPast) return [];
    const duration = activeDay.duration || 30;
    const dayIdx = (parseISO(activeDay.date).getDay() + 6) % 7;
    const rule = rules.find((r) => r.day_of_week === dayIdx);
    const computedFromRule = bookingDaySlots(rule, activeDay.date, busySlots, now);
    const baseSlots =
      computedFromRule.length > 0
        ? computedFromRule
        : generateFallbackSlots(activeDay.date, busySlots, now, duration);

    return baseSlots.map((s) => {
      if (isSlotOccupied(activeDay.date, s.time, duration, busySlots)) {
        return { ...s, available: false, reason: "ocupado" as const };
      }
      const isSameAsCurrent =
        activeDay.date === appointment.appointment_date && s.time === currentStartShort;
      if (isSameAsCurrent) {
        return { ...s, available: false, reason: "ocupado" as const };
      }
      if (
        !canModifyWithMinimumNotice(
          {
            appointment_date: activeDay.date,
            start_time: s.time,
            status: "confirmed",
          },
          now,
        )
      ) {
        return { ...s, available: false, reason: "pasado" as const };
      }
      return s;
    });
  }, [activeDay, rules, busySlots, now, appointment.appointment_date, currentStartShort]);

  const availableSlotsCount = useMemo(
    () => displayedSlots.filter((s) => s.available).length,
    [displayedSlots],
  );

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

  function handleDatePickerChange(nextDate: string) {
    if (!nextDate || nextDate < today) return;
    setSelectedDate(nextDate);
    setWeekStart(getWeekMonday(nextDate));
    setSlot("");
  }

  async function handleConfirmReschedule() {
    if (!activeDay || !slot || savingRef.current) return;

    if (!canModifyWithMinimumNotice(appointment, new Date())) {
      toast.error(MIN_NOTICE_MESSAGE);
      onClose();
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const duration = activeDay.duration || 30;
      const newEndTime = format(
        addMinutes(parseISO(`${activeDay.date}T${slot}`), duration),
        "HH:mm",
      );

      const { data, error } = await supabase
        .from("appointments")
        .update({
          appointment_date: activeDay.date,
          start_time: slot,
          end_time: newEndTime,
        })
        .eq("id", appointment.id)
        .select("id, appointment_date, start_time, end_time")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("No se pudo actualizar la cita. Verifica tus permisos.");
      }

      if (onRescheduled) {
        onRescheduled({
          id: appointment.id,
          appointment_date: activeDay.date,
          start_time: slot,
          end_time: newEndTime,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["booking-availability"] }),
        queryClient.invalidateQueries({ queryKey: ["booking-day-busy"] }),
        queryClient.invalidateQueries({ queryKey: ["reschedule-availability"] }),
        queryClient.invalidateQueries({ queryKey: ["reschedule-day-busy"] }),
      ]);

      toast.success("¡Cita reagendada con éxito!");
      onClose();
    } catch (error) {
      console.error("Error al reagendar cita:", error);
      toast.error(translateRescheduleError(error));
      setSlot("");
      await Promise.all([availability.refetch(), dayBusyQuery.refetch()]);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <CalendarClock className="size-5 text-primary" />
          Reagendar cita médica
        </DialogTitle>
        <DialogDescription>
          Selecciona una nueva fecha y bloque horario disponible para tu atención.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 pt-2">
        {/* Profesional asignado (Solo lectura) */}
        <div className="rounded-xl border border-border bg-surface-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-clinical-soft text-primary">
                <Stethoscope className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Profesional asignado
                </p>
                <p className="text-base font-bold text-foreground">{doctorName}</p>
                <p className="text-xs text-muted-foreground">{doctorSpecialty}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              Actual: {format(parseISO(appointment.appointment_date), "d MMM", { locale: es })} ·{" "}
              {currentStartShort} – {currentEndShort}
            </Badge>
          </div>
        </div>

        {/* Selector de nueva fecha (Date picker + tira semanal) */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label
              htmlFor="reschedule-date-picker"
              className="flex items-center gap-1.5 text-sm font-bold text-foreground"
            >
              <CalendarDays className="size-4 text-primary" />
              Selecciona nueva fecha
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="reschedule-date-picker"
                type="date"
                min={today}
                value={activeDay?.date ?? selectedDate}
                onChange={(e) => handleDatePickerChange(e.target.value)}
                className="h-8 w-40 text-xs bg-background"
                aria-label="Seleccionar nueva fecha"
              />
              <span className="hidden text-xs font-semibold capitalize text-muted-foreground sm:inline">
                {weekHeaderLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-full border-border/80 hover:border-primary hover:text-primary"
              aria-label="Semana anterior"
              onClick={handlePrevWeek}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <div
              role="group"
              aria-label="Selector semanal para reagendar"
              className="grid flex-1 grid-cols-7 gap-1 sm:gap-1.5"
            >
              {weekDays.map((day) => {
                const isSelected = activeDay?.date === day.date && !day.isPast;
                const isDisabled = day.isPast || !day.isAvailable;

                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={isDisabled}
                    aria-pressed={isSelected}
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
              aria-label="Semana siguiente"
              onClick={handleNextWeek}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Bloques horarios disponibles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Clock3 className="size-4 text-primary" />
              Bloques horarios disponibles
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
                <div key={i} className="h-10 animate-pulse rounded-full bg-muted/60" />
              ))}
            </div>
          ) : displayedSlots.length > 0 ? (
            <div
              role="group"
              aria-label="Bloques horarios para reagendar"
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
              No hay bloques disponibles en la fecha seleccionada. Elige otro día de la semana.
            </div>
          )}
        </div>

        {/* Confirmación de nuevo horario */}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!slot || saving}
            onClick={() => void handleConfirmReschedule()}
            className="gap-2 font-bold shadow-clinical"
          >
            <CalendarCheck className="size-4" />
            {saving
              ? "Guardando nuevo horario…"
              : slot
                ? `Confirmar Reagendamiento - ${slot}`
                : "Selecciona un nuevo horario"}
          </Button>
        </div>
      </div>
    </>
  );
}
