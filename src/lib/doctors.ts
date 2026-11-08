import { supabase } from "@/lib/supabase";
import type { PublicDoctor } from "@/lib/booking";

type DoctorRow = {
  id: string;
  full_name: string;
  specialty: string;
  bio?: string | null;
  photo_url?: string | null;
  consultation_fee?: number | string | null;
  price?: number | string | null; // nombre de la columna en algunas versiones de la base
  is_active?: boolean | null;
};

/**
 * Profesionales activos, leídos desde el navegador (igual que el diálogo de reserva).
 * Se pide `*` y se normaliza porque la tarifa puede llamarse `consultation_fee` o `price` según el proyecto.
 */
export async function fetchPublicDoctors(): Promise<(PublicDoctor & { is_active: boolean })[]> {
  const { data, error } = await supabase.from("doctors").select("*").order("full_name");
  if (error) {
    console.error("Error al cargar profesionales:", error);
    const host = String(import.meta.env["VITE_SUPABASE_URL"] ?? "sin VITE_SUPABASE_URL").replace(/^https?:\/\//, "");
    throw new Error(`${error.message} (código ${error.code ?? "?"}) · proyecto: ${host}`);
  }
  return ((data ?? []) as DoctorRow[])
    .filter((row) => row.is_active !== false)
    .map((row) => ({
      id: row.id,
      full_name: row.full_name,
      specialty: row.specialty,
      bio: row.bio ?? "",
      photo_url: row.photo_url ?? null,
      consultation_fee: Number(row.consultation_fee ?? row.price ?? 0),
      is_active: true,
    }));
}
