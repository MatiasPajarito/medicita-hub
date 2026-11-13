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

interface BaseAppointmentRow {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  modality: string;
  status: string;
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatSupabaseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const obj = error as { message?: unknown; code?: unknown; details?: unknown };
    const parts = [obj.code, obj.message, obj.details].filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
    if (parts.length > 0) return parts.join(" — ");
  }
  return "Error desconocido al consultar la cita.";
}

function VideoconsultaRoutePage() {
  const { appointmentId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [noteOpen, setNoteOpen] = useState(false);

  const query = useQuery({
    queryKey: ["teleconsulta-appointment-v2", appointmentId, user.id],
    enabled: Boolean(appointmentId),
    retry: false,
    queryFn: async () => {
      const [apptRes, rolesRes] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, doctor_id, patient_id, appointment_date, start_time, end_time, modality, status",
          )
          .eq("id", appointmentId)
          .limit(1),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      if (apptRes.error) {
        throw new Error(formatSupabaseError(apptRes.error));
      }

      const typedBase = (apptRes.data?.[0] as BaseAppointmentRow | undefined) ?? null;
      if (!typedBase) {
        throw new Error(
          `APPOINTMENT_NOT_FOUND: No se encontró la cita (${appointmentId}) o las políticas de acceso no devolvieron registros.`,
        );
      }

      const [docRes, patRes] = await Promise.all([
        supabase
          .from("doctors")
          .select("id, full_name, specialty, user_id")
          .eq("id", typedBase.doctor_id)
          .limit(1),
        supabase
          .from("patients")
          .select("id, full_name, rut_dni, email, phone, user_id")
          .eq("id", typedBase.patient_id)
          .limit(1),
      ]);

      const doctorInfo = unwrapSingle(docRes.data as DoctorInfo[] | null);
      let patientInfo = unwrapSingle(patRes.data as PatientInfo[] | null);

      if (!patientInfo) {
        const ownRes = await supabase
          .from("patients")
          .select("id, full_name, rut_dni, email, phone, user_id")
          .eq("user_id", user.id)
          .limit(1);
        const ownPatient = unwrapSingle(ownRes.data as PatientInfo[] | null);
        if (ownPatient && ownPatient.id === typedBase.patient_id) {
          patientInfo = ownPatient;
        }
      }

      const userRoles = (rolesRes.data ?? []).map((r) => r.role);
      const isPatientOwner = patientInfo?.user_id === user.id || typedBase.patient_id === user.id;
      const isDoctorOwner = doctorInfo?.user_id === user.id;
      const isAdmin = userRoles.includes("admin");

      if (!isPatientOwner && !isDoctorOwner && !isAdmin) {
        throw new Error(
          `UNAUTHORIZED_APPOINTMENT: Tu usuario no coincide con el paciente ni el médico asignado (doc=${String(Boolean(doctorInfo))}, pat=${String(Boolean(patientInfo))}).`,
        );
      }

      let existingNote: ConsultationNoteRecord | null = null;
      if (isDoctorOwner || isAdmin) {
        const { data: noteRows } = await supabase
          .from("consultation_notes")
          .select("*")
          .eq("appointment_id", typedBase.id)
          .limit(1);
        existingNote = (noteRows?.[0] as ConsultationNoteRecord | undefined) ?? null;
      }

      return {
        appointment: typedBase,
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
    const errorMsg = formatSupabaseError(query.error);
    const unauthorized = errorMsg.startsWith("UNAUTHORIZED_APPOINTMENT");
    if (query.error) {
      console.error("Error cargando videoconsulta:", query.error);
    }
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
            <p className="w-full break-words rounded-md border border-border bg-surface-subtle/60 px-3 py-2 font-mono text-xs text-muted-foreground">
              Detalle: {errorMsg}
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
          bookingCode: null,
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
