import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "@/components/medicita/page-heading";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { professionalSchema, type ProfessionalInput } from "@/lib/booking";
import { normalizeRut } from "@/lib/clinical-schemas";
import { supabase } from "@/lib/supabase";

export function ProfessionalProfile({ doctor }: { doctor: ProfessionalInput & { id: string } }) {
  const queryClient = useQueryClient();
  const form = useForm<ProfessionalInput>({ resolver: zodResolver(professionalSchema), defaultValues: doctor });
  const submit = form.handleSubmit(async (values) => {
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) { toast.error("Tu sesión expiró. Inicia sesión nuevamente."); return; }
    const { error } = await supabase.from("doctors").update({ ...values, rut_dni: normalizeRut(values.rut_dni), updated_at: new Date().toISOString() }).eq("id", doctor.id).eq("user_id", data.user.id).select("id").single();
    if (error) { console.error("Error al actualizar profesional:", error); toast.error(error.message); return; }
    await queryClient.invalidateQueries({ queryKey: ["profile-kind"] });
    await queryClient.invalidateQueries({ queryKey: ["doctors"] });
    toast.success("Perfil profesional guardado");
  });
  return <><PageHeading eyebrow="Portal profesional" title="Perfil Profesional" description="Datos y registro de tu práctica clínica." /><div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><Form {...form}><form onSubmit={submit} className="grid gap-6 sm:grid-cols-2">
    {([ ["full_name", "Nombre completo"], ["rut_dni", "RUT"], ["specialty", "Especialidad"], ["medical_registration", "Registro médico / Superintendencia"] ] as const).map(([name, label]) => <FormField key={name} name={name} control={form.control} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />)}
    <FormField name="modalities" control={form.control} render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Modalidades de atención</FormLabel><div className="flex flex-wrap gap-6">{([ ["presencial", "Presencial"], ["telemedicina", "Telemedicina"] ] as const).map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><Checkbox checked={field.value.includes(value)} onCheckedChange={(checked) => field.onChange(checked ? [...field.value, value] : field.value.filter((v) => v !== value))} />{label}</label>)}</div><FormMessage /></FormItem>} />
    <FormField name="bio" control={form.control} render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Biografía profesional</FormLabel><FormControl><Textarea {...field} rows={5} /></FormControl><FormMessage /></FormItem>} />
    <Button className="sm:col-span-2 sm:justify-self-end" disabled={form.formState.isSubmitting} type="submit"><Save />{form.formState.isSubmitting ? "Guardando…" : "Guardar cambios"}</Button>
  </form></Form></div></>;
}