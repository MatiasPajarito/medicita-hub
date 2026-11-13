import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Video } from "lucide-react";
import {
  ConsultationNoteDialog,
  type ConsultationAppointmentTarget,
  type ConsultationNoteRecord,
} from "@/components/medicita/consultation-note-dialog";
import { TeleconsultaRoom } from "@/components/medicita/teleconsulta-room";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/videoconsulta/$appointmentId")({
  component: VideoconsultaRoutePage,
});

type DoctorInfo = {
  id: string;
  full_name: string;
  specialty: string;
  user_id: string | null;
};

type PatientInfo = {
  id: string;
  full_name: string;
  rut_dni: string;
  email: string;
  phone: string;
  user_id: string;
};

interface LoadedAppointmentRow {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  modality: string;
  status: string;
  booking_code: string | null;
  doctor: DoctorInfo | DoctorInfo[] | null;
  patient: PatientInfo | PatientInfo[] | null;
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function VideoconsultaRoutePage() {
  const { appointmentId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [noteOpen, setNoteOpen] = useState(false);

  const query = useQuery({
    queryKey: ["teleconsulta-appointment", appointmentId, user.id],
    enabled: Boolean(appointmentId),
    queryFn: async () => {
      const [{ data: fullJoin, error: joinError }, { data: rolesData }] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, doctor_id, patient_id, appointment_date, start_time, end_time, modality, status, booking_code, doctor:doctors(id, full_name, specialty, user_id), patient:patients(id, full_name, rut_dni, email, phone, user_id)",
          )
          .eq("id", appointmentId)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      let appointmentRow: LoadedAppointmentRow | null = null;
      if (!joinError && fullJoin) {
        appointmentRow = fullJoin as unknown as LoadedAppointmentRow;
      } else {
        // Fallback when nested patients RLS prevents doctor/admin embedded reads
        const { data: basicJoin, error: basicError } = await supabase
          .from("appointments")
          .select(
            "id, doctor_id, patient_id, appointment_date, start_time, end_time, modality, status, booking_code, doctor:doctors(id, full_name, specialty, user_id)",
          )
          .eq("id", appointmentId)
          .maybeSingle();

        if (basicError) throw basicError;
        if (basicJoin) {
          appointmentRow = {
            ...(basicJoin as unknown as Omit<LoadedAppointmentRow, "patient">),
            patient: null,
          };
        }
      }

      if (!appointmentRow) return null;

      const doctorInfo = unwrapSingle(appointmentRow.doctor);
      let patientInfo = unwrapSingle(appointmentRow.patient);

      if (!patientInfo) {
        const { data: ownPatient } = await supabase
          .from("patients")
          .select("id, full_name, rut_dni, email, phone, user_id")
          .eq("id", appointmentRow.patient_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (ownPatient) {
          patientInfo = ownPatient;
        }
      }

      const userRoles = (rolesData ?? []).map((r) => r.role);
      const isPatientOwner = patientInfo?.user_id === user.id;
      const isDoctorOwner = doctorInfo?.user_id === user.id;
      const isAdmin = userRoles.includes("admin");

      if (!isPatientOwner && !isDoctorOwner && !isAdmin) {
        throw new Error("UNAUTHORIZED_APPOINTMENT");
      }

      let existingNote: ConsultationNoteRecord | null = null;
      if (isDoctorOwner || isAdmin) {
        const { data: noteData } = await supabase
          .from("consultation_notes")
          .select("*")
          .eq("appointment_id", appointmentRow.id)
          .maybeSingle();
        existingNote = (noteData as ConsultationNoteRecord | null) ?? null;
      }

      return {
        appointment: appointmentRow,
        doctorInfo,
        patientInfo,
        existingNote,
        viewerRole: isDoctorOwner
          ? ("doctor" as const)
          : isAdmin
            ? ("admin" as const)
            : ("patient" as const),
      };
    },
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[520px] w-full rounded-xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    const unauthorized =
      query.error instanceof Error && query.error.message === "UNAUTHORIZED_APPOINTMENT";
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="border-border bg-card shadow-card">
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" aria-hidden="true" />
              <h1 className="text-lg font-semibold">
                {unauthorized
                  ? "Acceso restringido a esta videoconsulta"
                  : "No pudimos cargar la videoconsulta"}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {unauthorized
                ? "Solo el paciente titular y el profesional tratante pueden acceder a esta sala clínica (Ley N° 20.584)."
                : "Verifica que la cita exista y corresponda a una atención por telemedicina."}
            </p>
            <Button asChild variant="default" className="gap-2">
              <Link to="/mi-agenda" search={{ tab: "upcoming" }}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Volver a mi agenda
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { appointment, doctorInfo, patientInfo, existingNote, viewerRole } = query.data;
  const participantName =
    viewerRole === "doctor"
      ? (doctorInfo?.full_name ?? user.email ?? "Profesional MediCita")
      : (patientInfo?.full_name ?? user.email ?? "Paciente MediCita");

  const backTo =
    viewerRole === "doctor" ? "/doctor/citas" : viewerRole === "admin" ? "/admin" : "/mi-agenda";

  const noteTarget: ConsultationAppointmentTarget | null =
    noteOpen && viewerRole === "doctor"
      ? {
          id: appointment.id,
          doctor_id: appointment.doctor_id,
          patient_id: appointment.patient_id,
          appointment_date: appointment.appointment_date,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          modality: appointment.modality,
          status: (appointment.status as ConsultationAppointmentTarget["status"]) ?? "confirmed",
          ...(patientInfo
            ? {
                patient: {
                  full_name: patientInfo.full_name,
                  rut_dni: patientInfo.rut_dni,
                  email: patientInfo.email,
                  phone: patientInfo.phone,
                  user_id: patientInfo.user_id,
                },
              }
            : {}),
        }
      : null;

  return (
    <>
      <TeleconsultaRoom
        appointment={{
          id: appointment.id,
          appointment_date: appointment.appointment_date,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          modality: appointment.modality,
          status: appointment.status,
          bookingCode: appointment.booking_code ?? null,
          doctorName: doctorInfo?.full_name ?? "Profesional MediCita",
          doctorSpecialty: doctorInfo?.specialty ?? "Telemedicina",
          patientName: patientInfo?.full_name ?? "Paciente",
          patientRut: patientInfo?.rut_dni ?? null,
        }}
        participantName={participantName}
        viewerRole={viewerRole}
        backTo={backTo}
        hasExistingNote={Boolean(existingNote)}
        onOpenClinicalNote={viewerRole === "doctor" ? () => setNoteOpen(true) : undefined}
      />

      {viewerRole === "doctor" && (
        <ConsultationNoteDialog
          appointment={noteTarget}
          doctorId={appointment.doctor_id}
          existingNote={existingNote}
          readOnly={false}
          onClose={() => setNoteOpen(false)}
          onSuccess={() => {
            void query.refetch();
            setNoteOpen(false);
          }}
        />
      )}

      <span className="sr-only">
        <Video aria-hidden="true" />
      </span>
    </>
  );
}
