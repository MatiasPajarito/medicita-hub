import { describe, expect, test } from "bun:test";
import { availableDates, matchesSpecialty, professionalSchema } from "./booking";
import { defaultDay } from "./schedule";

describe("clinical bookings", () => {
  const doctor = { id: "one", full_name: "Doctora", specialty: "Salud Mental", bio: "", photo_url: null, consultation_fee: 0 };
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
    const days = availableDates([defaultDay(0)], [{ appointment_date: "2026-11-09", start_time: "09:00:00", end_time: "09:30:00" }], "2026-11-09", new Date("2026-11-03T09:00:00"));
    expect(days[0]?.slots[0]?.time).toBe("09:30");
  });
  test("a date without availability offers the closest real working day", () => {
    const days = availableDates([defaultDay(0)], [], "2026-11-08", new Date("2026-11-03T09:00:00"));
    expect(days[0]?.date).toBe("2026-11-09");
  });
  test("professional requires valid RUT and at least one modality", () => {
    const data = { full_name: "Doctora Ejemplo", rut_dni: "12.345.678-5", specialty: "Cardiología", medical_registration: "12345", modalities: ["presencial"], bio: "Biografía profesional" };
    expect(professionalSchema.safeParse(data).success).toBe(true);
    expect(professionalSchema.safeParse({ ...data, modalities: [] }).success).toBe(false);
    expect(professionalSchema.safeParse({ ...data, rut_dni: "12.345.678-9" }).success).toBe(false);
  });
});