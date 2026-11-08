import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { z } from "zod";
import { defaultDay, generateSlots, mondayIndex, type DayRule, type Slot } from "@/lib/schedule";
import { isValidChileanRut } from "@/lib/clinical-schemas";
import { normalizeText } from "@/lib/doctor-filter";

export const professionalSchema = z.object({
  full_name: z.string().trim().min(2, "Ingresa tu nombre completo"),
  rut_dni: z.string().refine(isValidChileanRut, "Ingresa un RUT chileno válido"),
  specialty: z.string().trim().min(1, "Ingresa tu especialidad"),
  medical_registration: z.string().trim().min(1, "Ingresa tu registro médico"),
  modalities: z
    .array(z.enum(["presencial", "telemedicina"]))
    .min(1, "Selecciona al menos una modalidad"),
  bio: z.string().trim().min(10, "Ingresa al menos 10 caracteres").max(1000),
});
export type ProfessionalInput = z.infer<typeof professionalSchema>;

export type PublicDoctor = {
  id: string;
  full_name: string;
  specialty: string;
  bio: string;
  photo_url: string | null;
  consultation_fee: number;
};

export type BusySlot = { appointment_date: string; start_time: string; end_time: string };

export const shortWeekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export type WeekDayItem = {
  date: string;
  dayLabel: string;
  dayNumber: string;
  monthShort: string;
  fullLabel: string;
  isPast: boolean;
  isAvailable: boolean;
  slots: Slot[];
  duration: number;
};

export const matchesSpecialty = (doctor: PublicDoctor, specialty: string) =>
  specialty === "all" ||
  specialty === "todas" ||
  doctor.specialty.toLocaleLowerCase("es") === specialty.toLocaleLowerCase("es") ||
  normalizeText(doctor.specialty) === normalizeText(specialty);

export function isSlotOccupied(
  dateKey: string,
  slotTime: string,
  durationMinutes: number,
  busy: BusySlot[],
): boolean {
  const [h = 0, m = 0] = slotTime.split(":").map(Number);
  const slotEnd = format(addDays(parseISO(dateKey), 0).setHours(h, m + durationMinutes), "HH:mm");
  return busy.some((b) => {
    if (b.appointment_date !== dateKey) return false;
    return b.start_time.slice(0, 5) < slotEnd && b.end_time.slice(0, 5) > slotTime;
  });
}

/**
 * Generates fallback 30-minute slots within standard doctor hours (09:00 to 18:00),
 * excluding occupied slots and past hours on the same day.
 */
export function generateFallbackSlots(
  dateKey: string,
  busy: BusySlot[] = [],
  now: Date = clinicNow(),
  durationMinutes = 30,
): Slot[] {
  const dateObj = parseISO(dateKey);
  const todayKey = format(now, "yyyy-MM-dd");
  if (dateKey < todayKey) return [];

  const sameDay = dateKey === todayKey;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = 9 * 60; // 09:00
  const endMin = 18 * 60; // 18:00
  const slots: Slot[] = [];

  for (let t = startMin; t + durationMinutes <= endMin; t += durationMinutes) {
    const hh = String(Math.floor(t / 60)).padStart(2, "0");
    const mm = String(t % 60).padStart(2, "0");
    const timeStr = `${hh}:${mm}`;
    const isPastHour = sameDay && t <= nowMin;
    const occupied = isSlotOccupied(dateKey, timeStr, durationMinutes, busy);
    if (!isPastHour && !occupied) {
      slots.push({ time: timeStr, available: true });
    }
  }
  return slots;
}

export function defaultWeeklyRules(): DayRule[] {
  return Array.from({ length: 7 }, (_, i) => defaultDay(i));
}

export function availableDates(rules: DayRule[], busy: BusySlot[], from: string, now: Date) {
  const effectiveRules = rules.length > 0 ? rules : defaultWeeklyRules();
  return Array.from({ length: 60 }, (_, i) => {
    const date = addDays(parseISO(from), i);
    const key = format(date, "yyyy-MM-dd");
    const rule = effectiveRules.find((r) => r.day_of_week === mondayIndex(date));
    const duration = rule?.slot_duration_minutes ?? 30;
    const slots = generateSlots(rule, date, now).filter(
      (s) => s.available && Boolean(rule) && !isSlotOccupied(key, s.time, duration, busy),
    );
    return { date: key, slots, duration };
  }).filter((d) => d.slots.length > 0);
}

/**
 * Returns the Monday (YYYY-MM-DD) of the week containing the given date string.
 */
export function getWeekMonday(dateStr: string): string {
  const d = parseISO(dateStr);
  return format(addDays(d, -mondayIndex(d)), "yyyy-MM-dd");
}

/**
 * Builds the 7-day horizontal strip items starting from `weekStart` (7 consecutive days).
 * Uses DB `doctor_schedules` rules when present, or falls back to standard 09:00-18:00 (30 min) schedule.
 */
export function buildWeekStrip(
  weekStart: string,
  rules: DayRule[],
  busy: BusySlot[],
  now: Date = clinicNow(),
): WeekDayItem[] {
  const todayKey = format(now, "yyyy-MM-dd");
  const hasActiveCustomRules = rules.some((r) => r.is_available);

  return Array.from({ length: 7 }, (_, i) => {
    const dateObj = addDays(parseISO(weekStart), i);
    const dateKey = format(dateObj, "yyyy-MM-dd");
    const dayIdx = mondayIndex(dateObj);
    const isPast = dateKey < todayKey;

    const customRule = hasActiveCustomRules
      ? rules.find((r) => r.day_of_week === dayIdx)
      : undefined;
    const rule = customRule ?? defaultDay(dayIdx);
    const duration = rule.slot_duration_minutes || 30;

    let slots: Slot[] = [];
    if (!isPast && rule.is_available) {
      slots = generateSlots(rule, dateObj, now).filter(
        (s) => s.available && !isSlotOccupied(dateKey, s.time, duration, busy),
      );
      // Fallback: if standard weekday schedule yielded no slots on a future date, generate 09:00-18:00 every 30m
      if (slots.length === 0 && dateKey > todayKey && !busy.some((b) => b.appointment_date === dateKey)) {
        slots = generateFallbackSlots(dateKey, busy, now, 30);
      }
    }

    return {
      date: dateKey,
      dayLabel: shortWeekDays[dayIdx] ?? "Lun",
      dayNumber: format(dateObj, "d"),
      monthShort: format(dateObj, "MMM", { locale: es }).replace(".", ""),
      fullLabel: format(dateObj, "EEEE d 'de' MMMM", { locale: es }),
      isPast,
      isAvailable: !isPast && slots.length > 0,
      slots,
      duration,
    };
  });
}

export function clinicNow() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return new Date(parts.replace(" ", "T"));
}
