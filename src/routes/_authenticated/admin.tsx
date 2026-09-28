import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useServerFn } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldAlert, Stethoscope, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeading } from "@/components/medicita/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { doctorSchema, specialties, type DoctorInput } from "@/lib/clinical-schemas";
import { createDoctor, getAdminDoctors, setDoctorActive } from "@/lib/clinical.functions";

export const Route = createFileRoute("/_authenticated/admin")({ head: () => ({ meta: [
  { title: "Administración de profesionales — MediCita" }, { name: "description", content: "Gestiona profesionales médicos de MediCita." },
  { property: "og:title", content: "Administración de profesionales — MediCita" }, { property: "og:description", content: "Alta y gestión segura de profesionales médicos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
] }), component: AdminPage });

function AdminPage() {
  const [open, setOpen] = useState(false);
  const fetchDoctors = useServerFn(getAdminDoctors);
  const addDoctor = useServerFn(createDoctor);
  const updateActive = useServerFn(setDoctorActive);
  const queryClient = useQueryClient();
  const doctors = useQuery({ queryKey: ["admin-doctors"], queryFn: () => fetchDoctors(), retry: false });
  const form = useForm<DoctorInput>({ resolver: zodResolver(doctorSchema), defaultValues: { full_name: "", specialty: "Medicina General", bio: "", photo_url: "", consultation_fee: 0, is_active: true } });
  const submit = form.handleSubmit(async (values) => { try { await addDoctor({ data: values }); await queryClient.invalidateQueries({ queryKey: ["admin-doctors"] }); await queryClient.invalidateQueries({ queryKey: ["doctors"] }); form.reset(); setOpen(false); toast.success("Profesional registrado"); } catch (error) { toast.error(error instanceof Error ? error.message : "No pudimos registrar al profesional"); } });
  if (doctors.isError) return <div className="mx-auto max-w-xl px-4 py-24 text-center"><ShieldAlert className="mx-auto size-12 text-destructive" /><h1 className="mt-5 text-2xl font-bold">Acceso restringido</h1><p className="mt-2 text-muted-foreground">Esta sección está disponible únicamente para administradores de MediCita.</p></div>;
  return <><PageHeading eyebrow="Administración" title="Profesionales médicos" description="Registra profesionales y controla su visibilidad en el directorio." action={<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus />Nuevo profesional</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Alta profesional</DialogTitle><DialogDescription>Completa los datos que se mostrarán en el directorio médico.</DialogDescription></DialogHeader><Form {...form}><form id="doctor-form" onSubmit={submit} className="grid gap-4 py-2"><FormField control={form.control} name="full_name" render={({ field }) => <FormItem><FormLabel>Nombre completo</FormLabel><FormControl><Input {...field} placeholder="Dra. Camila Rojas" /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="specialty" render={({ field }) => <FormItem><FormLabel>Especialidad</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{specialties.map((specialty) => <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /><FormField control={form.control} name="bio" render={({ field }) => <FormItem><FormLabel>Biografía</FormLabel><FormControl><Textarea {...field} rows={4} placeholder="Experiencia, enfoque clínico y formación relevante" /></FormControl><FormMessage /></FormItem>} /><div className="grid gap-4 sm:grid-cols-2"><FormField control={form.control} name="photo_url" render={({ field }) => <FormItem><FormLabel>URL de fotografía</FormLabel><FormControl><Input {...field} type="url" placeholder="https://…" /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="consultation_fee" render={({ field }) => <FormItem><FormLabel>Tarifa de consulta (CLP)</FormLabel><FormControl><Input {...field} type="number" min="0" /></FormControl><FormMessage /></FormItem>} /></div><FormField control={form.control} name="is_active" render={({ field }) => <FormItem className="flex items-center justify-between rounded-md border p-3"><div><FormLabel>Visible en el directorio</FormLabel><p className="text-xs text-muted-foreground">Disponible para nuevas citas</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} /></form></Form><DialogFooter><Button type="submit" form="doctor-form" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Registrando…" : "Registrar profesional"}</Button></DialogFooter></DialogContent></Dialog>} /><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{doctors.isLoading ? <p className="text-muted-foreground">Cargando profesionales…</p> : <div className="grid gap-4">{doctors.data?.map((doctor) => <Card key={doctor.id} className="shadow-none"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-clinical-soft text-primary"><UserRound /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{doctor.full_name}</h2><Badge variant="secondary">{doctor.specialty}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{doctor.bio}</p></div><div className="flex items-center gap-3"><span className="text-sm font-semibold">${doctor.consultation_fee.toLocaleString("es-CL")}</span><Switch aria-label={`Cambiar estado de ${doctor.full_name}`} checked={doctor.is_active} onCheckedChange={async (checked) => { try { await updateActive({ data: { id: doctor.id, is_active: checked } }); await queryClient.invalidateQueries({ queryKey: ["admin-doctors"] }); await queryClient.invalidateQueries({ queryKey: ["doctors"] }); } catch { toast.error("No pudimos actualizar el estado"); } }} /></div></CardContent></Card>)}{doctors.data?.length === 0 && <div className="py-20 text-center"><Stethoscope className="mx-auto size-10 text-muted-foreground" /><p className="mt-3 text-muted-foreground">No hay profesionales registrados.</p></div>}</div>}</div></>;
}
