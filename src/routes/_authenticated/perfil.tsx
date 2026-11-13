import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContactRound, Download, HeartPulse, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeading } from "@/components/medicita/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { bloodTypes, normalizeRut, patientSchema, type PatientInput } from "@/lib/clinical-schemas";
import {
  buildPatientDataExport,
  buildPatientExportFilename,
  createHealthConsentRecord,
  extractHealthConsentFromMetadata,
  revokeTelemedicineConsent,
} from "@/lib/health-privacy";
import { supabase } from "@/lib/supabase";
import { ProfessionalProfile } from "@/components/medicita/professional-profile";
import type { ProfessionalInput } from "@/lib/booking";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil de paciente — MediCita" },
      { name: "description", content: "Actualiza tus datos personales y antecedentes clínicos en MediCita." },
      { property: "og:title", content: "Mi perfil de paciente — MediCita" },
      { property: "og:description", content: "Datos personales y antecedentes clínicos protegidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const emptyValues: PatientInput = {
  full_name: "",
  rut_dni: "",
  email: "",
  phone: "",
  birth_date: "",
  blood_type: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  allergies: "",
  chronic_conditions: "",
  medical_history_notes: "",
};

function ProfilePage() {
  const profileKind = useQuery({ queryKey: ["profile-kind"], queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Tu sesión expiró.");
    const [roles, doctor] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
      supabase.from("doctors").select("*").eq("user_id", auth.user.id).maybeSingle(),
    ]);
    if (roles.error || doctor.error) throw new Error("No pudimos identificar tu perfil. Inténtalo nuevamente más tarde.");
    return { professional: !!doctor.data || roles.data?.some((r) => r.role === "doctor"), doctor: doctor.data };
  } });
  if (profileKind.isPending) return <p className="mx-auto max-w-5xl px-4 py-8 text-muted-foreground">Cargando tu perfil…</p>;
  if (profileKind.isError) return <p role="alert" className="mx-auto max-w-5xl px-4 py-8 text-destructive">{profileKind.error.message}</p>;
  if (profileKind.data.professional) {
    const doctor = profileKind.data.doctor;
    if (!doctor) return <><PageHeading eyebrow="Portal profesional" title="Perfil Profesional" description="Datos de tu práctica clínica." /><p className="mx-auto max-w-3xl px-4 py-8 text-muted-foreground">Tu cuenta profesional aún no está vinculada a una ficha médica. Solicita la vinculación a un administrador.</p></>;
    const data = doctor as unknown as Partial<ProfessionalInput> & { id: string };
    return <ProfessionalProfile doctor={{ id: data.id, full_name: data.full_name ?? "", rut_dni: data.rut_dni ?? "", specialty: data.specialty ?? "", medical_registration: data.medical_registration ?? "", modalities: data.modalities ?? [], bio: data.bio ?? "" }} />;
  }
  return <PatientProfile />;
}

function PatientProfile() {
  const queryClient = useQueryClient();
  const [exportingData, setExportingData] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  const authUserQuery = useQuery({
    queryKey: ["patient-auth-metadata"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      return data.user;
    },
  });

  const consentRecord = extractHealthConsentFromMetadata(
    authUserQuery.data?.user_metadata as Record<string, unknown> | undefined,
  );

  async function handleAcceptConsent() {
    setSavingConsent(true);
    try {
      const nextConsent = createHealthConsentRecord(new Date(), true);
      const { error } = await supabase.auth.updateUser({
        data: { health_privacy_consent: nextConsent },
      });
      if (error) throw error;
      await authUserQuery.refetch();
      toast.success("Consentimiento de datos de salud registrado.");
    } catch {
      toast.error("No pudimos registrar el consentimiento. Inténtalo de nuevo.");
    } finally {
      setSavingConsent(false);
    }
  }

  async function handleRevokeTelemedicine() {
    setSavingConsent(true);
    try {
      const nextConsent = revokeTelemedicineConsent(consentRecord, new Date());
      const { error } = await supabase.auth.updateUser({
        data: { health_privacy_consent: nextConsent },
      });
      if (error) throw error;
      await authUserQuery.refetch();
      toast.success("Consentimiento de telemedicina revocado correctamente.");
    } catch {
      toast.error("No pudimos actualizar tu preferencia de consentimiento.");
    } finally {
      setSavingConsent(false);
    }
  }

  async function handleDownloadClinicalData() {
    if (!profile.data) {
      toast.error("Guarda primero tus datos básicos antes de descargar tu ficha.");
      return;
    }

    setExportingData(true);
    try {
      const [apptsRes, notesRes] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, appointment_date, start_time, end_time, modality, status, booking_code, order_code, doctor:doctors(full_name, specialty)",
          )
          .eq("patient_id", profile.data.id)
          .order("appointment_date", { ascending: false }),
        supabase
          .from("consultation_notes")
          .select(
            "id, appointment_id, created_at, updated_at, diagnosis, treatment_plan, prescriptions, observations",
          )
          .eq("patient_id", profile.data.id)
          .order("created_at", { ascending: false }),
      ]);

      if (apptsRes.error) throw apptsRes.error;
      if (notesRes.error) throw notesRes.error;

      type DoctorMeta = { full_name?: string | null; specialty?: string | null };
      type ApptRow = {
        id: string;
        appointment_date: string;
        start_time: string;
        end_time: string;
        modality: string;
        status: string | null;
        booking_code: string | null;
        order_code: string | null;
        doctor: DoctorMeta | DoctorMeta[] | null;
      };

      const exportPayload = buildPatientDataExport({
        patient: profile.data,
        consent: consentRecord,
        appointments: ((apptsRes.data ?? []) as unknown as ApptRow[]).map((a) => {
          const doc = Array.isArray(a.doctor) ? (a.doctor[0] ?? null) : a.doctor;
          return {
            id: a.id,
            appointment_date: a.appointment_date,
            start_time: a.start_time,
            end_time: a.end_time,
            modality: a.modality,
            status: a.status,
            booking_code: a.booking_code,
            order_code: a.order_code,
            doctor_name: doc?.full_name ?? null,
            specialty: doc?.specialty ?? null,
          };
        }),
        clinicalNotes: notesRes.data ?? [],
      });

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildPatientExportFilename(
        profile.data.rut_dni || profile.data.full_name,
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast.success("Copia de tu ficha y datos descargada.");
    } catch (err) {
      console.error("Error al exportar datos clínicos:", err);
      toast.error("No pudimos generar la descarga de tus datos en este momento.");
    } finally {
      setExportingData(false);
    }
  }

  const profile = useQuery({
    queryKey: ["patient-profile"],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) return null;

      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error al obtener perfil del paciente:", error);
        return null;
      }
      return data;
    },
  });

  const form = useForm<PatientInput>({
    resolver: zodResolver(patientSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (profile.data) {
      form.reset({
        full_name: profile.data.full_name ?? "",
        rut_dni: profile.data.rut_dni ?? "",
        email: profile.data.email ?? "",
        phone: profile.data.phone ?? "",
        birth_date: profile.data.birth_date ?? "",
        blood_type: profile.data.blood_type ?? "",
        emergency_contact_name: profile.data.emergency_contact_name ?? "",
        emergency_contact_phone: profile.data.emergency_contact_phone ?? "",
        allergies: profile.data.allergies ?? "",
        chronic_conditions: profile.data.chronic_conditions ?? "",
        medical_history_notes: profile.data.medical_history_notes ?? "",
      });
    }
  }, [profile.data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");

      const payload = {
        full_name: values.full_name,
        rut_dni: normalizeRut(values.rut_dni),
        email: values.email,
        phone: values.phone,
        birth_date: values.birth_date,
        blood_type: values.blood_type || null,
        emergency_contact_name: values.emergency_contact_name || null,
        emergency_contact_phone: values.emergency_contact_phone || null,
        allergies: values.allergies,
        chronic_conditions: values.chronic_conditions,
        medical_history_notes: values.medical_history_notes,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("patients")
        .upsert({ ...payload, user_id: userData.user.id }, { onConflict: "user_id" });

      if (error) {
        console.error("Error al actualizar paciente:", error);
        throw new Error(error.message);
      }

      await queryClient.invalidateQueries({ queryKey: ["patient-profile"] });
      toast.success("Perfil guardado correctamente");
    } catch (error) {
      console.error("Error al actualizar paciente:", error);
      toast.error(error instanceof Error ? error.message : "No pudimos guardar tu perfil");
    }
  });

  return (
    <>
      <PageHeading
        eyebrow="Mi salud"
        title="Perfil de paciente"
        description="Mantén tus datos y antecedentes actualizados para recibir una atención más segura."
        action={
          <span className="flex items-center gap-2 text-sm font-semibold text-success">
            <ShieldCheck className="size-4" />
            Información privada
          </span>
        }
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {profile.isLoading ? (
          <p className="text-muted-foreground">Cargando tu perfil…</p>
        ) : (
          <Form {...form}>
            <form onSubmit={onSubmit} className="grid gap-6">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ContactRound className="text-primary" />
                    Datos personales
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  {[
                    ["full_name", "Nombre completo", "Ej. Camila Rojas", "text"],
                    ["rut_dni", "RUT", "12.345.678-5", "text"],
                    ["email", "Correo electrónico", "nombre@correo.cl", "email"],
                    ["phone", "Teléfono", "+56 9 1234 5678", "tel"],
                    ["birth_date", "Fecha de nacimiento", "", "date"],
                  ].map(([name, label, placeholder, type]) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name as "full_name"}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input {...field} type={type} placeholder={placeholder} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  <FormField
                    control={form.control}
                    name="blood_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grupo sanguíneo</FormLabel>
                        <Select
                          key={field.value || "empty"}
                          value={field.value ?? ""}
                          onValueChange={(val) => field.onChange(val)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {bloodTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle>Contacto de emergencia</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  {[
                    ["emergency_contact_name", "Nombre del contacto", "Nombre y apellido"],
                    ["emergency_contact_phone", "Teléfono de emergencia", "+56 9 1234 5678"],
                  ].map(([name, label, placeholder]) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name as "emergency_contact_name"}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={placeholder} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HeartPulse className="text-primary" />
                    Antecedentes médicos
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5">
                  {[
                    ["allergies", "Alergias", "Medicamentos, alimentos u otras alergias"],
                    ["chronic_conditions", "Condiciones crónicas", "Ej. hipertensión, diabetes"],
                    ["medical_history_notes", "Otros antecedentes", "Cirugías, tratamientos o información relevante"],
                  ].map(([name, label, placeholder]) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name as "allergies"}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder={placeholder} rows={3} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card className="border-primary/20 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LockKeyhole className="size-5 text-primary" aria-hidden="true" />
                    Privacidad y Derechos del Titular (Ley N° 19.628 y N° 20.584)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-lg border border-border bg-surface-subtle/60 p-3.5">
                    {consentRecord ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">
                            Consentimiento informado activo ({consentRecord.version})
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Registrado el{" "}
                            {new Date(consentRecord.acceptedAt).toLocaleDateString("es-CL", {
                              dateStyle: "long",
                            })}{" "}
                            ·{" "}
                            {consentRecord.telemedicineRevokedAt
                              ? "Telemedicina revocada por el titular (custodia clínica vigente según Ley N° 20.584 Art. 13)."
                              : `Alcance: ficha clínica, datos sensibles y telemedicina (${consentRecord.lawReference}).`}
                          </p>
                        </div>
                        {consentRecord.telemedicineRevokedAt ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={savingConsent}
                            onClick={() => void handleAcceptConsent()}
                          >
                            {savingConsent ? "Actualizando…" : "Reactivar telemedicina"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={savingConsent}
                            onClick={() => void handleRevokeTelemedicine()}
                          >
                            {savingConsent ? "Procesando…" : "Revocar telemedicina"}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Aún no registras confirmación explícita de consentimiento en tu sesión para telemedicina y resguardo clínico.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={savingConsent}
                          onClick={() => void handleAcceptConsent()}
                        >
                          {savingConsent ? "Registrando…" : "Confirmar consentimiento"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Puedes descargar una copia estructurada (JSON) de tu perfil, citas y ficha clínica o revisar nuestra{" "}
                      <Link
                        to="/privacidad"
                        className="font-semibold text-primary underline underline-offset-2"
                      >
                        política de datos de salud
                      </Link>
                      .
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={exportingData || !profile.data}
                      onClick={() => void handleDownloadClinicalData()}
                      className="min-h-10 gap-2"
                    >
                      <Download className="size-4" aria-hidden="true" />
                      {exportingData ? "Generando archivo…" : "Descargar mis datos clínicos"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  <Save />
                  {form.formState.isSubmitting ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </>
  );
}
