import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  MapPin,
  Plus,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeading } from "@/components/medicita/page-heading";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { doctorSchema, specialties, type DoctorInput } from "@/lib/clinical-schemas";
import { defaultCities, formatFeeCLP } from "@/lib/doctor-filter";
import { supabase } from "@/lib/supabase";

export interface AdminDoctorRow {
  id: string;
  full_name: string;
  specialty: string;
  city: string;
  bio: string;
  photo_url: string | null;
  consultation_fee: number;
  is_active: boolean;
  user_id: string | null;
}

function translateDeleteDoctorError(error: unknown): string {
  if (error && typeof error === "object") {
    const errObj = error as { code?: unknown; message?: unknown };
    const code = typeof errObj.code === "string" ? errObj.code : "";
    const message = typeof errObj.message === "string" ? errObj.message : "";
    if (code === "23503") {
      return "No se puede eliminar este profesional porque tiene citas o fichas clínicas asociadas. Puedes desactivarlo con el interruptor Activo/Inactivo.";
    }
    if (code === "42501" || /row-level security/i.test(message)) {
      return "No tienes permisos de administrador para eliminar profesionales.";
    }
    if (message) return message;
  }
  return "No pudimos eliminar al profesional.";
}

export function AdminDoctorsPanel() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDoctorCity, setNewDoctorCity] = useState<string>("Santiago");
  const [deleteTarget, setDeleteTarget] = useState<AdminDoctorRow | null>(null);

  const doctorsQuery = useQuery({
    queryKey: ["admin-doctors"],
    queryFn: async (): Promise<AdminDoctorRow[]> => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .order("full_name", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        full_name: row.full_name,
        specialty: row.specialty,
        city: row.city?.trim() ? row.city.trim() : "Santiago",
        bio: row.bio,
        photo_url: row.photo_url,
        consultation_fee: row.consultation_fee,
        is_active: row.is_active,
        user_id: row.user_id,
      }));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      doctorId,
      nextActive,
    }: {
      doctorId: string;
      nextActive: boolean;
    }) => {
      const { data, error } = await supabase
        .from("doctors")
        .update({ is_active: nextActive })
        .eq("id", doctorId)
        .select("id, is_active")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error("No se pudo actualizar el estado del profesional. Verifica tus permisos.");
      }

      return { id: doctorId, is_active: data.is_active };
    },
    onSuccess: (result) => {
      toast.success(
        result.is_active
          ? "Profesional activado en el directorio"
          : "Profesional marcado como inactivo",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      void queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar el estado");
    },
  });

  const deleteDoctorMutation = useMutation({
    mutationFn: async (doctor: AdminDoctorRow) => {
      const { error } = await supabase.from("doctors").delete().eq("id", doctor.id);
      if (error) throw error;
      return doctor.id;
    },
    onSuccess: () => {
      setDeleteTarget(null);
      toast.success("Profesional eliminado del directorio");
      void queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      void queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
    onError: (error) => {
      toast.error(translateDeleteDoctorError(error));
    },
  });

  const form = useForm<DoctorInput>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      full_name: "",
      specialty: "Medicina General",
      bio: "",
      photo_url: "",
      consultation_fee: 0,
      is_active: true,
    },
  });

  const handleCreateSubmit = form.handleSubmit(async (values) => {
    try {
      const { error } = await supabase.from("doctors").insert({
        full_name: values.full_name,
        specialty: values.specialty,
        city: newDoctorCity || "Santiago",
        bio: values.bio,
        photo_url: values.photo_url ? values.photo_url : null,
        consultation_fee: values.consultation_fee,
        is_active: values.is_active,
      });

      if (error) throw new Error(error.message);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-doctors"] }),
        queryClient.invalidateQueries({ queryKey: ["doctors"] }),
      ]);

      form.reset({
        full_name: "",
        specialty: "Medicina General",
        bio: "",
        photo_url: "",
        consultation_fee: 0,
        is_active: true,
      });
      setNewDoctorCity("Santiago");
      setCreateDialogOpen(false);
      toast.success("Profesional registrado exitosamente");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos registrar al profesional",
      );
    }
  });

  const doctorsList = doctorsQuery.data ?? [];

  return (
    <>
      <PageHeading
        eyebrow="Panel de Administración"
        title="Gestión de Profesionales Médicos"
        description="Administra el directorio clínico, controla la disponibilidad activa de cada especialista o elimina registros."
        action={
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Nuevo profesional
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Alta profesional</DialogTitle>
                <DialogDescription>
                  Completa los datos que se mostrarán en el directorio médico de MediCita.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form id="doctor-create-form" onSubmit={handleCreateSubmit} className="grid gap-4 py-2">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Dra. Camila Rojas" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="specialty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Especialidad</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent position="popper">
                              {specialties.map((specialty) => (
                                <SelectItem key={specialty} value={specialty}>
                                  {specialty}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <Label htmlFor="doctor-city-select">Ciudad</Label>
                      <Select value={newDoctorCity} onValueChange={setNewDoctorCity}>
                        <SelectTrigger id="doctor-city-select">
                          <SelectValue placeholder="Seleccionar ciudad" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {defaultCities.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Biografía clínica</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder="Experiencia, enfoque clínico y formación relevante"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="photo_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL de fotografía</FormLabel>
                          <FormControl>
                            <Input {...field} type="url" placeholder="https://…" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="consultation_fee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tarifa de consulta (CLP)</FormLabel>
                          <FormControl>
                            <Input
                              value={field.value}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              onChange={(event) => field.onChange(event.target.valueAsNumber)}
                              type="number"
                              min="0"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <FormLabel>Visible en el directorio</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Disponible para nuevas citas médicas
                          </p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
              <DialogFooter>
                <Button
                  type="submit"
                  form="doctor-create-form"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Registrando…" : "Registrar profesional"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {doctorsQuery.isPending ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : doctorsQuery.isError ? (
          <Card className="border-destructive/40 bg-destructive/10 p-8 text-center">
            <h2 className="text-lg font-bold text-destructive">
              No pudimos cargar el listado de profesionales
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{doctorsQuery.error.message}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void doctorsQuery.refetch()}
            >
              Reintentar
            </Button>
          </Card>
        ) : doctorsList.length === 0 ? (
          <Card className="border-dashed border-border bg-card shadow-none">
            <CardContent className="py-16 text-center">
              <Stethoscope className="mx-auto size-12 text-muted-foreground" />
              <p className="mt-3 text-base font-bold text-foreground">
                No hay profesionales registrados en el directorio
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Utiliza el botón "Nuevo profesional" para agregar el primer especialista.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {doctorsList.map((doctor) => {
              const isTogglingThis =
                toggleActiveMutation.isPending &&
                toggleActiveMutation.variables?.doctorId === doctor.id;

              return (
                <Card
                  key={doctor.id}
                  className="border-border bg-card shadow-xs transition-all hover:border-primary/30"
                >
                  <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-clinical-soft text-primary">
                        <UserRound className="size-6" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-bold text-foreground">
                            {doctor.full_name}
                          </h2>
                          <Badge variant="secondary">{doctor.specialty}</Badge>
                          <Badge variant="outline" className="gap-1 text-xs">
                            <MapPin className="size-3 text-primary" />
                            {doctor.city}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              doctor.is_active
                                ? "border-success/30 bg-success-soft text-success"
                                : "border-border bg-muted text-muted-foreground"
                            }
                          >
                            {doctor.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                        <p className="line-clamp-1 text-sm text-muted-foreground">
                          {doctor.bio}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-3 lg:border-t-0 lg:pt-0">
                      <div className="text-left lg:text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Tarifa consulta
                        </p>
                        <p className="text-sm font-extrabold text-foreground">
                          {formatFeeCLP(doctor.consultation_fee)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <label
                          htmlFor={`switch-active-${doctor.id}`}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                        >
                          <Switch
                            id={`switch-active-${doctor.id}`}
                            aria-label={`Cambiar estado activo de ${doctor.full_name}`}
                            checked={doctor.is_active}
                            disabled={isTogglingThis}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({
                                doctorId: doctor.id,
                                nextActive: checked,
                              })
                            }
                          />
                          <span>{doctor.is_active ? "Activo" : "Inactivo"}</span>
                        </label>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(doctor)}
                        >
                          <Trash2 className="size-4" />
                          <span>Eliminar profesional</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* AlertDialog de confirmación para eliminar profesional */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteDoctorMutation.isPending) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Eliminar profesional del directorio
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmas que deseas eliminar permanentemente a{" "}
              <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.specialty}) de la base de
              datos de MediCita? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDoctorMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteDoctorMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteDoctorMutation.mutate(deleteTarget);
                }
              }}
            >
              {deleteDoctorMutation.isPending ? "Eliminando…" : "Confirmar eliminación"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
