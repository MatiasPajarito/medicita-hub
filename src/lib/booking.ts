import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";
import { generateSlots, mondayIndex, type DayRule } from "@/lib/schedule";
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
export const matchesSpecialty = (doctor: PublicDoctor, specialty: string) =>
  specialty === "all" ||
  specialty === "todas" ||
  doctor.specialty.toLocaleLowerCase("es") === specialty.toLocaleLowerCase("es") ||
  normalizeText(doctor.specialty) === normalizeText(specialty);
export function availableDates(rules: DayRule[], busy: BusySlot[], from: string, now: Date) {
  return Array.from({ length: 60 }, (_, i) => {
    const date = addDays(parseISO(from), i);
    const key = format(date, "yyyy-MM-dd");
    const rule = rules.find((r) => r.day_of_week === mondayIndex(date));
    const slots = generateSlots(rule, date, now).filter(
      (s) =>
        s.available &&
        !busy.some((b) => {
          if (b.appointment_date !== key || !rule) return false;
          const [h = 0, m = 0] = s.time.split(":").map(Number);
          const end = format(addDays(date, 0).setHours(h, m + rule.slot_duration_minutes), "HH:mm");
          return b.start_time.slice(0, 5) < end && b.end_time.slice(0, 5) > s.time;
        }),
    );
    return { date: key, slots, duration: rule?.slot_duration_minutes ?? 30 };
  }).filter((d) => d.slots.length > 0);
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
