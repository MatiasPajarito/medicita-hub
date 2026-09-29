import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, HeartPulse, IdCard, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { isValidChileanRut, normalizeRut } from "@/lib/clinical-schemas";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/acceso")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" && search["redirect"].startsWith("/") ? search["redirect"] : "/",
    mode: search["mode"] === "registro" ? ("registro" as const) : ("login" as const),
  }),
  head: () => ({
    meta: [
      { title: "Acceso — MediCita" },
      { name: "description", content: "Accede de forma segura a tu cuenta de MediCita." },
      { property: "og:title", content: "Acceso — MediCita" },
      { property: "og:description", content: "Accede a tus citas y atención clínica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccessPage,
});

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Ingresa tu nombre completo").max(120, "Máximo 120 caracteres"),
  rut_dni: z.string().trim().min(1, "Ingresa tu RUT").refine(isValidChileanRut, "Ingresa un RUT chileno válido (ej: 12.345.678-9)"),
  birth_date: z
    .string()
    .min(1, "Ingresa tu fecha de nacimiento")
    .refine((date) => !Number.isNaN(Date.parse(`${date}T00:00:00`)), "Ingresa una fecha válida")
    .refine((date) => new Date(`${date}T00:00:00`) <= new Date(), "La fecha no puede estar en el futuro"),
  email: z.string().trim().min(1, "Ingresa tu correo").email("Ingresa un correo válido").max(255),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(72),
});
type SignUpInput = z.infer<typeof signUpSchema>;

function AccessPage() {
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { redirect, mode } = Route.useSearch();
  const isRegistering = mode === "registro";

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: "", rut_dni: "", birth_date: "", email: "", password: "" },
  });

  const toggleMode = (targetMode: "login" | "registro") => {
    navigate({
      search: (prev) => ({ ...prev, mode: targetMode }),
    });
  };

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    if (!email || password.length < 6) {
      toast.error("Ingresa un correo y una contraseña de al menos 6 caracteres");
      return;
    }
    setSubmitting(true);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    await navigate({ to: redirect as "/" });
  }

  async function signUp(data: SignUpInput) {
    setSubmitting(true);
    const rut = normalizeRut(data.rut_dni);
    const result = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { emailRedirectTo: `${window.location.origin}${redirect}` },
    });
    if (result.error) {
      setSubmitting(false);
      toast.error(result.error.message);
      return;
    }
    const userId = result.data.user?.id;
    if (!result.data.session || !userId) {
      setSubmitting(false);
      toast.success("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.");
      return;
    }
    const { error } = await supabase.from("patients").insert({
      user_id: userId,
      full_name: data.full_name,
      rut_dni: rut,
      birth_date: data.birth_date,
      email: data.email,
      phone: "",
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") toast.error("Este RUT ya está registrado con otra cuenta.");
      else toast.error("Tu cuenta fue creada, pero no pudimos guardar tu ficha inicial.");
      await navigate({ to: redirect as "/" });
      return;
    }
    toast.success(`¡Bienvenido/a a MediCita, ${data.full_name.split(" ")[0]}! Tu cuenta está lista.`);
    await navigate({ to: redirect as "/" });
  }

  async function signInGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error(result.error.message);
    else if (!result.redirected) await navigate({ to: "/" });
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4.25rem)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="hidden lg:block">
        <span className="flex size-14 items-center justify-center rounded-lg bg-clinical-soft text-primary">
          <HeartPulse className="size-7" />
        </span>
        <h1 className="mt-6 max-w-md text-4xl font-bold">Tu información de salud, siempre contigo.</h1>
        <p className="mt-4 max-w-md text-lg leading-8 text-muted-foreground">
          Accede a tus citas, fichas e indicaciones en un espacio privado y seguro.
        </p>
        <p className="mt-8 flex items-center gap-2 text-sm font-semibold text-success">
          <ShieldCheck />
          Protección de datos clínicos
        </p>
      </div>
      <Card className="mx-auto w-full max-w-md shadow-clinical">
        <CardContent className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold">{isRegistering ? "Crea tu cuenta" : "Bienvenido a MediCita"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRegistering
              ? "Regístrate con tus datos de paciente para agendar citas."
              : "Ingresa para administrar tu salud."}
          </p>

          {isRegistering ? (
            <Form {...form}>
              <form className="mt-7 grid gap-4" onSubmit={form.handleSubmit(signUp)}>
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <UserRound className="absolute left-3 top-3 size-4 text-muted-foreground" />
                          <Input className="h-11 pl-10" placeholder="María González Pérez" maxLength={120} {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="rut_dni"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RUT / DNI</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IdCard className="absolute left-3 top-3 size-4 text-muted-foreground" />
                            <Input className="h-11 pl-10" placeholder="12.345.678-9" maxLength={12} {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de nacimiento</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <CalendarDays className="absolute left-3 top-3 size-4 text-muted-foreground" />
                            <Input className="h-11 pl-10" type="date" max={new Date().toISOString().slice(0, 10)} {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electrónico</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
                          <Input className="h-11 pl-10" type="email" placeholder="nombre@correo.cl" maxLength={255} {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <LockKeyhole className="absolute left-3 top-3 size-4 text-muted-foreground" />
                          <Input className="h-11 pl-10" type="password" placeholder="Mínimo 6 caracteres" maxLength={72} {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button className="h-11" type="submit" disabled={submitting}>
                  {submitting ? "Creando cuenta…" : "Crear cuenta"}
                </Button>
              </form>
            </Form>
          ) : (
            <form className="mt-7 grid gap-5" onSubmit={signIn}>
              <div className="grid gap-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input id="email" name="email" type="email" required maxLength={255} className="h-11 pl-10" placeholder="nombre@correo.cl" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input id="password" name="password" type="password" required minLength={6} maxLength={72} className="h-11 pl-10" placeholder="Mínimo 6 caracteres" />
                </div>
              </div>
              <Button className="h-11" type="submit" disabled={submitting}>
                {submitting ? "Procesando…" : "Iniciar sesión"}
              </Button>
            </form>
          )}

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">o</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="h-11 w-full" onClick={signInGoogle}>
            Continuar con Google
          </Button>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isRegistering ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 font-bold"
              onClick={() => toggleMode(isRegistering ? "login" : "registro")}
            >
              {isRegistering ? "Iniciar sesión" : "Crear cuenta"}
            </Button>
          </p>
          <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">
            Volver al inicio
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
