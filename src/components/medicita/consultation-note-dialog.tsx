import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  IdCard,
  Lock,
  Pill,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

export interface ConsultationNoteRecord {
  id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  diagnosis: string;
  treatment_plan: string;
  prescriptions: string | null;
  observations: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultationAppointmentTarget {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  modality: string;
  status: "confirmed" | "scheduled" | "completed" | "cancelled";
  patient?: {
    full_name: string;
    rut_dni: string;
    email: string;
    phone: string;
    user_id?: string | undefined;
  };
}

export interface ConsultationNoteDialogProps {
  appointment: ConsultationAppointmentTarget | null;
  doctorId: string | null;
  existingNote: ConsultationNoteRecord | null;
  readOnly?: boolean;
  onClose: () => void;
  onSuccess?: (result: {
    appointmentId: string;
    note: ConsultationNoteRecord;
  }) => void;
}

function formatNoteErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const errObj = error as { code?: unknown; message?: unknown };
    const code = typeof errObj.code === "string" ? errObj.code : "";
    const message = typeof errObj.message === "string" ? errObj.message : "";
    if (code === "23505") {
      return "Esta cita ya cuenta con una ficha clínica registrada.";
    }
    if (code === "23503") {
      return "No se pudo vincular la ficha clínica: verifica que tu perfil médico esté activo.";
    }
    if (code === "42501" || /row-level security/i.test(message)) {
      return "No tienes permisos para registrar notas clínicas en esta cita.";
    }
    if (message) return message;
  }
  return "No pudimos guardar la ficha clínica. Inténtalo nuevamente.";
}

export function ConsultationNoteDialog({
  appointment,
  doctorId,
  existingNote,
  readOnly = false,
  onClose,
  onSuccess,
}: ConsultationNoteDialogProps) {
  const [saving, setSaving] = useState(false);
  const isReadOnly = readOnly || Boolean(existingNote);

  return (
    <Dialog
      open={Boolean(appointment)}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {appointment && (
          <ConsultationNotePanel
            key={`${appointment.id}-${existingNote?.id ?? "new"}`}
            appointment={appointment}
            doctorId={doctorId}
            existingNote={existingNote}
            isReadOnly={isReadOnly}
            saving={saving}
            onSavingChange={setSaving}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConsultationNotePanel({
  appointment,
  doctorId,
  existingNote,
  isReadOnly,
  saving,
  onSavingChange,
  onClose,
  onSuccess,
}: {
  appointment: ConsultationAppointmentTarget;
  doctorId: string | null;
  existingNote: ConsultationNoteRecord | null;
  isReadOnly: boolean;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onClose: () => void;
  onSuccess?:
    | ((result: { appointmentId: string; note: ConsultationNoteRecord }) => void)
    | undefined;
}) {
  const queryClient = useQueryClient();
  const [diagnosis, setDiagnosis] = useState(existingNote?.diagnosis ?? "");
  const [treatmentPlan, setTreatmentPlan] = useState(existingNote?.treatment_plan ?? "");
  const [prescriptions, setPrescriptions] = useState(existingNote?.prescriptions ?? "");
  const [observations, setObservations] = useState(existingNote?.observations ?? "");
  const [errors, setErrors] = useState<{
    diagnosis?: string | undefined;
    treatmentPlan?: string | undefined;
  }>({});
  const submittingRef = useRef(false);

  useEffect(() => {
    return () => onSavingChange(false);
  }, [onSavingChange]);

  const patientName = appointment.patient?.full_name ?? "Paciente agendado";
  const patientRut = appointment.patient?.rut_dni ?? "No especificado";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isReadOnly || submittingRef.current) return;

    const cleanDiagnosis = diagnosis.trim();
    const cleanTreatment = treatmentPlan.trim();
    const cleanPrescriptions = prescriptions.trim();
    const cleanObservations = observations.trim();

    const nextErrors: { diagnosis?: string; treatmentPlan?: string } = {};
    if (!cleanDiagnosis) {
      nextErrors.diagnosis = "El diagnóstico clínico es obligatorio.";
    }
    if (!cleanTreatment) {
      nextErrors.treatmentPlan = "El plan de tratamiento e indicaciones son obligatorios.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const resolvedDoctorId = doctorId ?? appointment.doctor_id;
    if (!resolvedDoctorId) {
      toast.error("No se encontró un perfil médico válido para registrar la ficha.");
      return;
    }

    setErrors({});
    submittingRef.current = true;
    onSavingChange(true);

    try {
      const primaryPayload = {
        appointment_id: appointment.id,
        doctor_id: resolvedDoctorId,
        patient_id: appointment.patient?.user_id ?? appointment.patient_id,
        diagnosis: cleanDiagnosis,
        treatment_plan: cleanTreatment,
        prescriptions: cleanPrescriptions ? cleanPrescriptions : null,
        observations: cleanObservations ? cleanObservations : null,
      };

      let insertRes = await supabase
        .from("consultation_notes")
        .insert(primaryPayload)
        .select("*")
        .single();

      // Si patient_id en la tabla referencia patients.id en vez de auth.uid() (o viceversa),
      // reintentar automáticamente con el identificador alternativo del paciente.
      if (
        insertRes.error &&
        appointment.patient?.user_id &&
        appointment.patient.user_id !== appointment.patient_id
      ) {
        insertRes = await supabase
          .from("consultation_notes")
          .insert({
            ...primaryPayload,
            patient_id: appointment.patient_id,
          })
          .select("*")
          .single();
      }

      if (insertRes.error) {
        throw insertRes.error;
      }

      const savedNote = insertRes.data as ConsultationNoteRecord;

      const { error: updateError } = await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", appointment.id)
        .eq("doctor_id", resolvedDoctorId);

      if (updateError) {
        throw updateError;
      }

      if (onSuccess) {
        onSuccess({
          appointmentId: appointment.id,
          note: savedNote,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["doctor-patient-appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["doctor-consultation-notes"] }),
        queryClient.invalidateQueries({ queryKey: ["doctor-dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["booking-availability"] }),
      ]);

      toast.success("Ficha clínica registrada y cita marcada como atendida");
      onClose();
    } catch (error) {
      console.error("Error al registrar ficha clínica:", error);
      toast.error(formatNoteErrorMessage(error));
    } finally {
      submittingRef.current = false;
      onSavingChange(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Stethoscope className="size-5 text-primary" />
            {isReadOnly ? "Ficha Clínica de Atención" : "Atender Paciente y Registrar Ficha"}
          </DialogTitle>
          {isReadOnly && (
            <Badge variant="outline" className="border-success/30 bg-success-soft text-success">
              <CheckCircle2 className="mr-1 size-3.5" />
              Atención completada
            </Badge>
          )}
        </div>
        <DialogDescription>
          {isReadOnly
            ? "Registro clínico en modo de solo lectura asociado a esta consulta."
            : "Registra el diagnóstico y plan terapéutico para completar la atención médica del paciente."}
        </DialogDescription>
      </DialogHeader>

      {/* Resumen de la cita y paciente */}
      <div className="rounded-xl border border-border bg-surface-subtle p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Paciente
            </p>
            <p className="mt-0.5 text-base font-bold text-foreground">{patientName}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <IdCard className="size-3.5 text-primary" />
              RUT: {patientRut}
            </p>
          </div>
          <div className="space-y-1 text-right text-xs text-muted-foreground">
            <p className="flex items-center justify-end gap-1.5 font-medium text-foreground">
              <CalendarDays className="size-3.5 text-primary" />
              <span className="capitalize">
                {format(parseISO(appointment.appointment_date), "EEEE d 'de' MMMM, yyyy", {
                  locale: es,
                })}
              </span>
            </p>
            <p className="flex items-center justify-end gap-1.5 font-medium text-foreground">
              <Clock3 className="size-3.5 text-primary" />
              {appointment.start_time.slice(0, 5)} – {appointment.end_time.slice(0, 5)} hrs
            </p>
          </div>
        </div>
      </div>

      {isReadOnly && existingNote ? (
        <div className="grid gap-4 pt-1">
          <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <FileText className="size-3.5" />
              Diagnóstico
            </Label>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {existingNote.diagnosis}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <ClipboardList className="size-3.5" />
              Plan de Tratamiento / Indicaciones
            </Label>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {existingNote.treatment_plan}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Pill className="size-3.5" />
              Receta / Fármacos prescritos
            </Label>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {existingNote.prescriptions?.trim() || "Sin prescripción farmacológica registrada."}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Lock className="size-3.5" />
              Observaciones privadas
            </Label>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {existingNote.observations?.trim() || "Sin observaciones adicionales."}
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar ficha
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 pt-1" noValidate>
          <div className="space-y-2">
            <Label htmlFor="note-diagnosis" className="flex items-center gap-1.5 text-sm font-bold">
              <FileText className="size-4 text-primary" />
              Diagnóstico <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="note-diagnosis"
              value={diagnosis}
              onChange={(e) => {
                setDiagnosis(e.target.value);
                if (errors.diagnosis) setErrors((prev) => ({ ...prev, diagnosis: undefined }));
              }}
              placeholder="Ej. Cefalea tensional episódica asociada a estrés laboral…"
              rows={3}
              required
              disabled={saving}
              aria-invalid={Boolean(errors.diagnosis)}
            />
            {errors.diagnosis && (
              <p className="text-xs font-medium text-destructive">{errors.diagnosis}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="note-treatment-plan"
              className="flex items-center gap-1.5 text-sm font-bold"
            >
              <ClipboardList className="size-4 text-primary" />
              Plan de Tratamiento / Indicaciones <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="note-treatment-plan"
              value={treatmentPlan}
              onChange={(e) => {
                setTreatmentPlan(e.target.value);
                if (errors.treatmentPlan) {
                  setErrors((prev) => ({ ...prev, treatmentPlan: undefined }));
                }
              }}
              placeholder="Indica reposo, medidas no farmacológicas, exámenes solicitados y pautas de control…"
              rows={3}
              required
              disabled={saving}
              aria-invalid={Boolean(errors.treatmentPlan)}
            />
            {errors.treatmentPlan && (
              <p className="text-xs font-medium text-destructive">{errors.treatmentPlan}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="note-prescriptions"
              className="flex items-center gap-1.5 text-sm font-bold"
            >
              <Pill className="size-4 text-primary" />
              Receta / Fármacos prescritos{" "}
              <span className="text-xs font-normal text-muted-foreground">(Opcional)</span>
            </Label>
            <Textarea
              id="note-prescriptions"
              value={prescriptions}
              onChange={(e) => setPrescriptions(e.target.value)}
              placeholder="Ej. Paracetamol 500 mg cada 8 horas por 3 días en caso de dolor…"
              rows={2}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="note-observations"
              className="flex items-center gap-1.5 text-sm font-bold"
            >
              <Lock className="size-4 text-muted-foreground" />
              Observaciones privadas{" "}
              <span className="text-xs font-normal text-muted-foreground">(Opcional)</span>
            </Label>
            <Textarea
              id="note-observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notas clínicas internas de seguimiento para próximas sesiones…"
              rows={2}
              disabled={saving}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="gap-2 bg-success text-success-foreground hover:bg-success/90"
            >
              <CheckCircle2 className="size-4" />
              {saving ? "Guardando ficha clínica…" : "Guardar Ficha y Completar Cita"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}
