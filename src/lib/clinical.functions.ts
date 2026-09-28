import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { doctorSchema, patientSchema } from "@/lib/clinical-schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  return createClient<Database>(process.env['SUPABASE_URL']!, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
}

export const listDoctors = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient().from("doctors").select("id, full_name, specialty, bio, photo_url, consultation_fee, is_active").eq("is_active", true).order("full_name");
  if (error) throw new Error("No pudimos cargar los profesionales.");
  return data;
});

export const getMyPatient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("patients").select("*").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("No pudimos cargar tu perfil.");
    return data;
  });

export const saveMyPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => patientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      ...data,
      blood_type: data.blood_type || null,
      emergency_contact_name: data.emergency_contact_name || null,
      emergency_contact_phone: data.emergency_contact_phone || null,
      user_id: context.userId,
    };
    const { data: saved, error } = await context.supabase.from("patients").upsert(payload, { onConflict: "user_id" }).select().single();
    if (error?.code === "23505") throw new Error("Este RUT ya está registrado.");
    if (error) throw new Error("No pudimos guardar tu perfil.");
    return saved;
  });

export const getAdminDoctors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.from("user_roles").select("id").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("No tienes permisos de administrador.");
    const { data, error } = await context.supabase.from("doctors").select("*").order("created_at", { ascending: false });
    if (error) throw new Error("No pudimos cargar los profesionales.");
    return data;
  });

export const createDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => doctorSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.from("user_roles").select("id").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("No tienes permisos de administrador.");
    const { data: created, error } = await context.supabase.from("doctors").insert({ ...data, photo_url: data.photo_url || null }).select().single();
    if (error) throw new Error("No pudimos registrar al profesional.");
    return created;
  });

export const setDoctorActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.from("user_roles").select("id").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("No tienes permisos de administrador.");
    const { error } = await context.supabase.from("doctors").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error("No pudimos actualizar al profesional.");
    return { ok: true };
  });
