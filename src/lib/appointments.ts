import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { clinicNow } from "@/lib/booking";

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  modality: string;
  status: string;
  doctors: { full_name: string; specialty: string; photo_url: string | null } | null;
  doctor?: { full_name: string; specialty: string };
};

export type AppointmentLike = {
  appointment_date: string;
  start_time: string;
  status: string;
};

export const activeStatuses = ["confirmed", "scheduled", "confirmada"];
export const cancelledStatuses = ["cancelled", "cancelada"];

export function normalizeAppointmentStatus(
  status: string,
): "confirmed" | "scheduled" | "completed" | "cancelled" {
  if (status === "cancelled" || status === "cancelada") return "cancelled";
  if (status === "completed" || status === "completada") return "completed";
  if (status === "scheduled") return "scheduled";
  return "confirmed";
}

export function isUpcoming(appointment: AppointmentLike, now = clinicNow()) {
  return (
    activeStatuses.includes(appointment.status) &&
    new Date(`${appointment.appointment_date}T${appointment.start_time}`) > now
  );
}

export function groupAppointments<T extends AppointmentLike>(
  appointments: T[],
  now = clinicNow(),
): { upcoming: T[]; history: T[] } {
  const byDate = (a: T, b: T) =>
    `${a.appointment_date}T${a.start_time}`.localeCompare(`${b.appointment_date}T${b.start_time}`);
  return {
    upcoming: appointments.filter((a) => isUpcoming(a, now)).sort(byDate),
    history: appointments.filter((a) => !isUpcoming(a, now)).sort((a, b) => byDate(b, a)),
  };
}

export function appointmentStatus(appointment: AppointmentLike, now = clinicNow()) {
  if (cancelledStatuses.includes(appointment.status)) {
    return { label: "Cancelada", tone: "cancelled" } as const;
  }
  if (
    ["completed", "completada"].includes(appointment.status) ||
    !isUpcoming(appointment, now)
  ) {
    return { label: "Completada", tone: "completed" } as const;
  }
  return { label: "Confirmada", tone: "confirmed" } as const;
}

export const patientAppointmentsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["appointments", userId],
    queryFn: async (): Promise<Appointment[]> => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || auth.user?.id !== userId) {
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      }
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (patientError) throw new Error(patientError.message);

      const patientIds = Array.from(
        new Set([patient?.id, userId].filter((id): id is string => Boolean(id))),
      );

      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id,patient_id,doctor_id,appointment_date,start_time,end_time,modality,status,doctors(full_name,specialty,photo_url)",
        )
        .in("patient_id", patientIds)
        .order("appointment_date")
        .order("start_time");
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => {
        const rawDoc = Array.isArray(row.doctors) ? (row.doctors[0] ?? null) : row.doctors;
        return {
          ...row,
          doctors: rawDoc,
          ...(rawDoc
            ? { doctor: { full_name: rawDoc.full_name, specialty: rawDoc.specialty } }
            : {}),
        };
      });
    },
  });

export async function cancelPatientAppointment(
  appointment: AppointmentLike & { id: string; patient_id?: string | undefined },
  userId: string,
) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || auth.user?.id !== userId) {
    throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
  }
  if (!isUpcoming(appointment)) throw new Error("Solo puedes cancelar citas futuras.");

  let query = supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointment.id)
    .in("status", activeStatuses);

  if (appointment.patient_id) {
    query = query.eq("patient_id", appointment.patient_id);
  }

  const { data, error } = await query.select("id,status").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("La cita ya cambió de estado o no tienes permiso para cancelarla.");
  return data;
}
