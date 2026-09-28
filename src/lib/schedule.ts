import { z } from "zod";

export const weekDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export const dayRuleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  is_available: z.boolean(),
  start_time: time,
  end_time: time,
  has_break: z.boolean(),
  break_start: time,
  break_end: time,
  slot_duration_minutes: z.number().int().min(5).max(240),
}).superRefine((d, ctx) => {
  if (toMin(d.end_time) <= toMin(d.start_time)) ctx.addIssue({ code: "custom", path: ["end_time"], message: "Debe ser posterior al inicio" });
  if (d.has_break && (toMin(d.break_end) <= toMin(d.break_start) || toMin(d.break_start) < toMin(d.start_time) || toMin(d.break_end) > toMin(d.end_time)))
    ctx.addIssue({ code: "custom", path: ["break_end"], message: "La pausa debe estar dentro del horario" });
});
export const weekScheduleSchema = z.object({ days: z.array(dayRuleSchema).length(7) });
export type DayRule = z.infer<typeof dayRuleSchema>;

export const defaultDay = (day: number): DayRule => ({
  day_of_week: day, is_available: day < 5, start_time: "09:00", end_time: "18:00",
  has_break: true, break_start: "13:00", break_end: "14:00", slot_duration_minutes: 30,
});

/** Monday-based index (0 = Lunes … 6 = Domingo) for a JS date. */
export const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;

export type Slot = { time: string; available: boolean; reason?: "pausa" | "pasado" };

/** Generate selectable slots for a date from its weekly rule. */
export function generateSlots(rule: DayRule | undefined, date: Date, now = new Date()): Slot[] {
  if (!rule || !rule.is_available) return [];
  const slots: Slot[] = [];
  const end = toMin(rule.end_time);
  const sameDay = date.toDateString() === now.toDateString();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const pastDay = !sameDay && date < now;
  for (let t = toMin(rule.start_time); t + rule.slot_duration_minutes <= end; t += rule.slot_duration_minutes) {
    const inBreak = rule.has_break && t < toMin(rule.break_end) && t + rule.slot_duration_minutes > toMin(rule.break_start);
    const past = pastDay || (sameDay && t <= nowMin);
    slots.push({ time: fromMin(t), available: !inBreak && !past, reason: inBreak ? "pausa" : past ? "pasado" : undefined });
  }
  return slots;
}
