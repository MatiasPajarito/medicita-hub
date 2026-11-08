import { describe, expect, test } from "vitest";
import { groupAppointments, isUpcoming, appointmentStatus, type Appointment } from "./appointments";

const now = new Date("2026-11-07T20:29:00");
const appointment: Appointment = { id: "a", patient_id: "p", doctor_id: "d", appointment_date: "2026-11-16", start_time: "09:00:00", end_time: "09:30:00", modality: "presencial", status: "confirmed", doctors: null };
describe("patient agenda rules", () => {
  test("confirmed future appointments belong to upcoming", () => expect(isUpcoming(appointment, now)).toBe(true));
  test("scheduled future appointments belong to upcoming", () => expect(isUpcoming({ ...appointment, status: "scheduled" }, now)).toBe(true));
  test("existing confirmada bookings remain visible", () => expect(isUpcoming({ ...appointment, status: "confirmada" }, now)).toBe(true));
  test("same-day past hours cannot be cancelled or listed as upcoming", () => expect(isUpcoming({ ...appointment, appointment_date: "2026-11-07", start_time: "20:00:00" }, now)).toBe(false));
  test("future cancelled appointments move to history", () => {
    const groups = groupAppointments([{ ...appointment, status: "cancelled" }], now);
    expect(groups.upcoming).toHaveLength(0);
    expect(groups.history.map((a) => a.id)).toEqual(["a"]);
  });
  test("past appointments and completed appointments belong to history", () => {
    const groups = groupAppointments([{ ...appointment, id: "past", appointment_date: "2026-11-01" }, { ...appointment, id: "completed", status: "completed" }], now);
    expect(groups.history.map((a) => a.id)).toEqual(["completed", "past"]);
  });
  test("upcoming appointments sort by date and time ascending", () => {
    expect(groupAppointments([{ ...appointment, id: "later", start_time: "10:00:00" }, appointment], now).upcoming.map((a) => a.id)).toEqual(["a", "later"]);
  });
  test("cancellation is persisted as cancelled and not treated as completed", () => expect(appointmentStatus({ ...appointment, status: "cancelled" }, now).tone).toBe("cancelled"));
});