import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useServerFn } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContactRound, HeartPulse, Save, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeading } from "@/components/medicita/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { bloodTypes, patientSchema, type PatientInput } from "@/lib/clinical-schemas";
import { getMyPatient, saveMyPatient } from "@/lib/clinical.functions";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [
    { title: "Mi perfil de paciente — MediCita" }, { name: "description", content: "Actualiza tus datos personales y antecedentes clínicos en MediCita." },
    { property: "og:title", content: "Mi perfil de paciente — MediCita" }, { property: "og:description", content: "Datos personales y antecedentes clínicos protegidos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: PatientProfile,
});

const emptyValues: PatientInput = { full_name: "", rut_dni: "", email: "", phone: "", birth_date: "", blood_type: "", emergency_contact_name: "", emergency_contact_phone: "", allergies: "", chronic_conditions: "", medical_history_notes: "" };

function PatientProfile() {
  const loadProfile = useServerFn(getMyPatient);
  const saveProfile = useServerFn(saveMyPatient);
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["patient-profile"], queryFn: () => loadProfile() });
  const form = useForm<PatientInput>({ resolver: zodResolver(patientSchema), defaultValues: emptyValues });
  useEffect(() => { if (profile.data) form.reset({ ...profile.data, blood_type: profile.data.blood_type ?? "", emergency_contact_name: profile.data.emergency_contact_name ?? "", emergency_contact_phone: profile.data.emergency_contact_phone ?? "" }); }, [profile.data, form]);
  const onSubmit = form.handleSubmit(async (values) => {
    try { await saveProfile({ data: values }); await queryClient.invalidateQueries({ queryKey: ["patient-profile"] }); toast.success("Perfil guardado correctamente"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "No pudimos guardar tu perfil"); }
  });
  return <><PageHeading eyebrow="Mi salud" title="Perfil de paciente" description="Mantén tus datos y antecedentes actualizados para recibir una atención más segura." action={<span className="flex items-center gap-2 text-sm font-semibold text-success"><ShieldCheck className="size-4" />Información privada</span>} /><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">{profile.isLoading ? <p className="text-muted-foreground">Cargando tu perfil…</p> : <Form {...form}><form onSubmit={onSubmit} className="grid gap-6"><Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><ContactRound className="text-primary" />Datos personales</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">{[["full_name","Nombre completo","Ej. Camila Rojas","text"],["rut_dni","RUT","12.345.678-5","text"],["email","Correo electrónico","nombre@correo.cl","email"],["phone","Teléfono","+56 9 1234 5678","tel"],["birth_date","Fecha de nacimiento","","date"]].map(([name,label,placeholder,type]) => <FormField key={name} control={form.control} name={name as "full_name"} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...field} type={type} placeholder={placeholder} /></FormControl><FormMessage /></FormItem>} />)}<FormField control={form.control} name="blood_type" render={({ field }) => <FormItem><FormLabel>Grupo sanguíneo</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl><SelectContent>{bloodTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /></CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle>Contacto de emergencia</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">{[["emergency_contact_name","Nombre del contacto","Nombre y apellido"],["emergency_contact_phone","Teléfono de emergencia","+56 9 1234 5678"]].map(([name,label,placeholder]) => <FormField key={name} control={form.control} name={name as "emergency_contact_name"} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...field} placeholder={placeholder} /></FormControl><FormMessage /></FormItem>} />)}</CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="text-primary" />Antecedentes médicos</CardTitle></CardHeader><CardContent className="grid gap-5">{[["allergies","Alergias","Medicamentos, alimentos u otras alergias"],["chronic_conditions","Condiciones crónicas","Ej. hipertensión, diabetes"],["medical_history_notes","Otros antecedentes","Cirugías, tratamientos o información relevante"]].map(([name,label,placeholder]) => <FormField key={name} control={form.control} name={name as "allergies"} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Textarea {...field} placeholder={placeholder} rows={3} /></FormControl><FormMessage /></FormItem>} />)}</CardContent></Card><div className="flex justify-end"><Button type="submit" disabled={form.formState.isSubmitting}><Save />{form.formState.isSubmitting ? "Guardando…" : "Guardar cambios"}</Button></div></form></Form>}</div></>;
}
