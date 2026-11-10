import { describe, expect, test } from "vitest";
import {
  availableDates,
  buildWeekStrip,
  generateFallbackSlots,
  getWeekMonday,
  matchesSpecialty,
  professionalSchema,
  bookingDaySlots,
  bookingErrorMessage,
  occupiedStatuses,
} from "./booking";
import { defaultDay } from "./schedule";

describe("clinical bookings", () => {
  const doctor = {
    id: "one",
    full_name: "Doctora",
    specialty: "Salud Mental",
    bio: "",
    photo_url: null,
    consultation_fee: 0,
  };
  test("specialty only lists doctors belonging to that specialty", () => {
    expect(matchesSpecialty(doctor, "Salud mental")).toBe(true);
    expect(matchesSpecialty(doctor, "Cardiología")).toBe(false);
    expect(matchesSpecialty(doctor, "all")).toBe(true);
  });
  test("default duration yields real 30-minute blocks", () => {
    const days = availableDates([defaultDay(0)], [], "2026-11-09", new Date("2026-11-03T09:00:00"));
    expect(days[0]?.slots.slice(0, 3).map((s) => s.time)).toEqual(["09:00", "09:30", "10:00"]);
    expect(days[0]?.slots.some((s) => s.time === "13:00")).toBe(false);
  });
  test("occupied blocks are not selectable", () => {
    const days = availableDates(
      [defaultDay(0)],
      [{ appointment_date: "2026-11-09", start_time: "09:00:00", end_time: "09:30:00" }],
      "2026-11-09",
      new Date("2026-11-03T09:00:00"),
    );
    expect(days[0]?.slots[0]?.time).toBe("09:30");
  });
  test("a date without availability offers the closest real working day", () => {
    const days = availableDates([defaultDay(0)], [], "2026-11-08", new Date("2026-11-03T09:00:00"));
    expect(days[0]?.date).toBe("2026-11-09");
  });
  test("weekly strip generates 7 days from saved 30-minute schedule rules", () => {
    const monday = getWeekMonday("2026-11-09");
    expect(monday).toBe("2026-11-09");
    const strip = buildWeekStrip(monday, [defaultDay(0)], [], new Date("2026-11-07T12:00:00"));
    expect(strip).toHaveLength(7);
    expect(strip[0]?.dayLabel).toBe("Lun");
    expect(strip[0]?.dayNumber).toBe("9");
    expect(strip[0]?.isAvailable).toBe(true);
    expect(strip[0]?.slots.slice(0, 4).map((s) => s.time)).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
    ]);
    // Weekend days disabled by default
    expect(strip[5]?.isAvailable).toBe(false);
    expect(strip[6]?.isAvailable).toBe(false);
  });
  test("a missing saved schedule never offers fabricated hours", () => {
    expect(buildWeekStrip("2026-11-09", [], [], new Date("2026-11-07T12:00:00")).every((day) => day.slots.length === 0)).toBe(true);
  });
  test("an unavailable weekday (e.g. Tuesday with is_available=false or missing rule) remains disabled with zero slots", () => {
    const rules = [
      defaultDay(0), // Lunes disponible
      { ...defaultDay(1), is_available: false }, // Martes explícitamente no disponible
      defaultDay(2), // Miércoles disponible
    ];
    const strip = buildWeekStrip("2026-11-09", rules, [], new Date("2026-11-07T12:00:00"));
    expect(strip[0]?.isAvailable).toBe(true);
    expect(strip[1]?.dayLabel).toBe("Mar");
    expect(strip[1]?.isAvailable).toBe(false);
    expect(strip[1]?.slots).toEqual([]);
    expect(strip[2]?.isAvailable).toBe(true);
    expect(strip[3]?.isAvailable).toBe(false);
    expect(strip[3]?.slots).toEqual([]);
  });
  test("an overlapping occupied range disables both intersecting slots but not the adjacent slot", () => {
    const slots = bookingDaySlots(defaultDay(0), "2026-11-09", [{ appointment_date: "2026-11-09", start_time: "09:15:00", end_time: "09:45:00" }], new Date("2026-11-07T12:00:00"));
    expect(slots.slice(0, 3).map(({ time, available, reason }) => ({ time, available, reason }))).toEqual([
      { time: "09:00", available: false, reason: "ocupado" },
      { time: "09:30", available: false, reason: "ocupado" },
      { time: "10:00", available: true, reason: undefined },
    ]);
  });
  test("confirmed and pending block availability but cancelled does not", () => {
    expect(occupiedStatuses.includes("confirmed")).toBe(true);
    expect(occupiedStatuses.includes("pending")).toBe(true);
    expect([...occupiedStatuses]).not.toContain("cancelled");
  });
  test("database exclusion conflicts are identified as a competing reservation", () => {
    expect(bookingErrorMessage({ code: "23P01" })).toBe("Este bloque horario acaba de ser reservado por otro paciente. Por favor selecciona otro horario.");
  });
  test("fallback slot generator creates 30-minute slots from 09:00 to 18:00 excluding occupied slots", () => {
    const slots = generateFallbackSlots(
      "2026-11-10",
      [{ appointment_date: "2026-11-10", start_time: "09:00:00", end_time: "09:30:00" }],
      new Date("2026-11-07T10:00:00"),
    );
    expect(slots[0]?.time).toBe("09:00");
    expect(slots[slots.length - 1]?.time).toBe("17:30");
  });
  test("professional requires valid RUT and at least one modality", () => {
    const data = {
      full_name: "Doctora Ejemplo",
      rut_dni: "12.345.678-5",
      specialty: "Cardiología",
      medical_registration: "12345",
      modalities: ["presencial"],
      bio: "Biografía profesional",
    };
    expect(professionalSchema.safeParse(data).success).toBe(true);
    expect(professionalSchema.safeParse({ ...data, modalities: [] }).success).toBe(false);
    expect(professionalSchema.safeParse({ ...data, rut_dni: "12.345.678-9" }).success).toBe(false);
  });
});
