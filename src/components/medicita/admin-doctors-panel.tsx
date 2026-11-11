import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  MapPin,
  Plus,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
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
import { defaultCities } from "@/lib/doctor-filter";
import { supabase } from "@/lib/supabase";

export interface AdminDoctorRow {
  id: string;
  full_name: string;
  specialty: string;
  city: string;
  bio: string;
  photo_url: string | null;
  consultation_fee: number | null;
  price?: number | null | undefined;
  rating?: number | null | undefined;
  is_active: boolean;
  user_id: string | null;
}

const ADMIN_SPECIALTIES = [
  "Medicina General",
  "Cardiología",
  "Salud Mental",
  "Traumatología",
  "Pediatría",
  "Dermatología",
  "Ginecología",
  "Neurología",
  "Oftalmología",
] as const;

const ADMIN_CITIES = [
  ...defaultCities,
  "Viña del Mar",
  "Concepción",
  "La Serena",
  "Temuco",
] as const;

function formatSafeDoctorFee(doctor: {
  consultation_fee?: number | null | undefined;
  price?: number | null | undefined;
}): string {
  const raw = doctor.consultation_fee ?? doctor.price ?? 0;
  const num = Number(raw);
  if (!Number.isFinite(num)) return "$0";
  return `$${num.toLocaleString("es-CL")}`;
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

function translateCreateDoctorError(error: unknown): string {
  if (error && typeof error === "object") {
    const errObj = error as { code?: unknown; message?: unknown };
    const code = typeof errObj.code === "string" ? errObj.code : "";
    const message = typeof errObj.message === "string" ? errObj.message : "";
    if (code === "42501" || /row-level security/i.test(message)) {
      return "No tienes permisos de administrador para registrar profesionales.";
    }
    if (code === "23505") {
      return "Ya existe un profesional registrado con estos datos.";
    }
    if (message) return message;
  }
  return "No pudimos registrar al profesional. Verifica los datos e inténtalo nuevamente.";
}

interface NewDoctorFormErrors {
  fullName?: string | undefined;
  specialty?: string | undefined;
  city?: string | undefined;
  consultationFee?: string | undefined;
}

export function AdminDoctorsPanel() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminDoctorRow | null>(null);

  // Estado del formulario "+ Nuevo profesional"
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState<string>("Medicina General");
  const [city, setCity] = useState<string>("Santiago");
  const [consultationFeeInput, setConsultationFeeInput] = useState<string>("35000");
  const [bio, setBio] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formErrors, setFormErrors] = useState<NewDoctorFormErrors>({});

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

      const rawRows = (data ?? []) as unknown as Array<Record<string, unknown>>;

      return rawRows.map((row) => {
        const rawFee = row["consultation_fee"] ?? row["price"] ?? 0;
        const parsedFee = Number(rawFee);
        const rawPrice = row["price"];
        const rawRating = row["rating"];

        return {
          id: typeof row["id"] === "string" ? row["id"] : "",
          full_name:
            typeof row["full_name"] === "string" && row["full_name"].trim().length > 0
              ? row["full_name"].trim()
              : "Profesional sin nombre",
          specialty:
            typeof row["specialty"] === "string" && row["specialty"].trim().length > 0
              ? row["specialty"].trim()
              : "Medicina General",
          city:
            typeof row["city"] === "string" && row["city"].trim().length > 0
              ? row["city"].trim()
              : "Santiago",
          bio: typeof row["bio"] === "string" ? row["bio"] : "",
          photo_url: typeof row["photo_url"] === "string" ? row["photo_url"] : null,
          consultation_fee: Number.isFinite(parsedFee) ? parsedFee : 0,
          price: typeof rawPrice === "number" && Number.isFinite(rawPrice) ? rawPrice : null,
          rating: typeof rawRating === "number" && Number.isFinite(rawRating) ? rawRating : null,
          is_active: row["is_active"] !== false,
          user_id: typeof row["user_id"] === "string" ? row["user_id"] : null,
        };
      });
    },
  });

  function resetCreateForm() {
    setFullName("");
    setSpecialty("Medicina General");
    setCity("Santiago");
    setConsultationFeeInput("35000");
    setBio("");
    setIsActive(true);
    setFormErrors({});
  }

  const createDoctorMutation = useMutation({
    mutationFn: async (payload: {
      full_name: string;
      specialty: string;
      city: string;
      consultation_fee: number;
      bio: string;
      is_active: boolean;
    }) => {
      const { data, error } = await supabase
        .from("doctors")
        .insert([
          {
            full_name: payload.full_name,
            specialty: payload.specialty,
            city: payload.city,
            consultation_fee: payload.consultation_fee,
            bio: payload.bio,
            photo_url: null,
            is_active: payload.is_active,
          },
        ])
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      resetCreateForm();
      setCreateDialogOpen(false);
      toast.success("Profesional registrado exitosamente en el directorio");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-doctors"] }),
        queryClient.invalidateQueries({ queryKey: ["doctors"] }),
      ]);
    },
    onError: (error) => {
      toast.error(translateCreateDoctorError(error));
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

  function handleCreateDoctorSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (createDoctorMutation.isPending) return;

    const cleanName = fullName.trim();
    const cleanSpecialty = specialty.trim();
    const cleanCity = city.trim() || "Santiago";
    const parsedFee = Number(consultationFeeInput);
    const cleanBio = bio.trim();

    const errors: NewDoctorFormErrors = {};
    if (cleanName.length < 2) {
      errors.fullName = "Ingresa el nombre completo del profesional.";
    }
    if (!cleanSpecialty) {
      errors.specialty = "Selecciona o ingresa una especialidad.";
    }
    if (!cleanCity) {
      errors.city = "Ingresa una ciudad válida.";
    }
    if (consultationFeeInput.trim() === "" || !Number.isFinite(parsedFee) || parsedFee < 0) {
      errors.consultationFee = "Ingresa una tarifa en CLP válida (0 o mayor).";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    createDoctorMutation.mutate({
      full_name: cleanName,
      specialty: cleanSpecialty,
      city: cleanCity,
      consultation_fee: Math.round(parsedFee),
      bio: cleanBio,
      is_active: isActive,
    });
  }

  const doctorsList = doctorsQuery.data ?? [];

  return (
    <>
      <PageHeading
        eyebrow="Panel de Administración"
        title="Gestión de Profesionales Médicos"
        description="Administra el directorio clínico, controla la disponibilidad activa de cada especialista o elimina registros."
        action={
          <Dialog
            open={createDialogOpen}
            onOpenChange={(open) => {
              if (!createDoctorMutation.isPending) {
                setCreateDialogOpen(open);
                if (!open) resetCreateForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Nuevo profesional
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Registrar nuevo profesional</DialogTitle>
                <DialogDescription>
                  Completa los datos clínicos del médico para incorporarlo al directorio de MediCita.
                </DialogDescription>
              </DialogHeader>

              <form
                id="doctor-create-form"
                onSubmit={handleCreateDoctorSubmit}
                className="grid gap-4 py-2"
                noValidate
              >
                {/* Nombre completo */}
                <div className="space-y-1.5">
                  <Label htmlFor="new-doctor-full-name" className="text-sm font-semibold">
                    Nombre completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-doctor-full-name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (formErrors.fullName) {
                        setFormErrors((prev) => ({ ...prev, fullName: undefined }));
                      }
                    }}
                    placeholder="Ej. Dra. Camila Rojas"
                    disabled={createDoctorMutation.isPending}
                    aria-invalid={Boolean(formErrors.fullName)}
                  />
                  {formErrors.fullName && (
                    <p className="text-xs font-medium text-destructive">{formErrors.fullName}</p>
                  )}
                </div>

                {/* Especialidad y Ciudad */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-doctor-specialty" className="text-sm font-semibold">
                      Especialidad <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={specialty}
                      onValueChange={(val) => {
                        setSpecialty(val);
                        if (formErrors.specialty) {
                          setFormErrors((prev) => ({ ...prev, specialty: undefined }));
                        }
                      }}
                      disabled={createDoctorMutation.isPending}
                    >
                      <SelectTrigger id="new-doctor-specialty">
                        <SelectValue placeholder="Selecciona especialidad" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {ADMIN_SPECIALTIES.map((spec) => (
                          <SelectItem key={spec} value={spec}>
                            {spec}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.specialty && (
                      <p className="text-xs font-medium text-destructive">{formErrors.specialty}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-doctor-city" className="text-sm font-semibold">
                      Ciudad <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={city}
                      onValueChange={(val) => {
                        setCity(val);
                        if (formErrors.city) {
                          setFormErrors((prev) => ({ ...prev, city: undefined }));
                        }
                      }}
                      disabled={createDoctorMutation.isPending}
                    >
                      <SelectTrigger id="new-doctor-city">
                        <SelectValue placeholder="Selecciona ciudad" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {ADMIN_CITIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.city && (
                      <p className="text-xs font-medium text-destructive">{formErrors.city}</p>
                    )}
                  </div>
                </div>

                {/* Tarifa de consulta */}
                <div className="space-y-1.5">
                  <Label htmlFor="new-doctor-fee" className="text-sm font-semibold">
                    Tarifa de consulta (CLP) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-doctor-fee"
                    type="number"
                    min="0"
                    step="1000"
                    value={consultationFeeInput}
                    onChange={(e) => {
                      setConsultationFeeInput(e.target.value);
                      if (formErrors.consultationFee) {
                        setFormErrors((prev) => ({ ...prev, consultationFee: undefined }));
                      }
                    }}
                    placeholder="35000"
                    disabled={createDoctorMutation.isPending}
                    aria-invalid={Boolean(formErrors.consultationFee)}
                  />
                  {formErrors.consultationFee && (
                    <p className="text-xs font-medium text-destructive">
                      {formErrors.consultationFee}
                    </p>
                  )}
                </div>

                {/* Breve reseña / bio (opcional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="new-doctor-bio" className="text-sm font-semibold">
                    Breve reseña / Biografía{" "}
                    <span className="text-xs font-normal text-muted-foreground">(Opcional)</span>
                  </Label>
                  <Textarea
                    id="new-doctor-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Experiencia clínica, áreas de interés y formación relevante…"
                    disabled={createDoctorMutation.isPending}
                  />
                </div>

                {/* Switch de activo por defecto */}
                <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
                  <div>
                    <Label htmlFor="new-doctor-active" className="text-sm font-semibold">
                      Profesional activo en el directorio
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Habilitado inmediatamente para recibir nuevas reservas
                    </p>
                  </div>
                  <Switch
                    id="new-doctor-active"
                    checked={isActive}
                    disabled={createDoctorMutation.isPending}
                    onCheckedChange={setIsActive}
                  />
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={createDoctorMutation.isPending}
                    onClick={() => {
                      setCreateDialogOpen(false);
                      resetCreateForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createDoctorMutation.isPending}>
                    {createDoctorMutation.isPending
                      ? "Guardando profesional…"
                      : "Guardar profesional"}
                  </Button>
                </DialogFooter>
              </form>
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
                            {doctor.full_name || "Profesional sin nombre"}
                          </h2>
                          <Badge variant="secondary">
                            {doctor.specialty || "Medicina General"}
                          </Badge>
                          <Badge variant="outline" className="gap-1 text-xs">
                            <MapPin className="size-3 text-primary" />
                            {doctor.city || "Santiago"}
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
                          {doctor.bio || "Sin biografía registrada"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-3 lg:border-t-0 lg:pt-0">
                      <div className="text-left lg:text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Tarifa consulta
                        </p>
                        <p className="text-sm font-extrabold text-foreground">
                          {formatSafeDoctorFee(doctor)}
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
