import { supabase } from "@/lib/supabase";
import type { PublicDoctor } from "@/lib/booking";

/** Lista de profesionales activos, leída directo desde el navegador (igual que el diálogo de reserva). */
export async function fetchPublicDoctors(): Promise<(PublicDoctor & { is_active: boolean })[]> {
  const { data, error } = await supabase
    .from("doctors")
    .select("id, full_name, specialty, bio, photo_url, consultation_fee, is_active")
    .eq("is_active", true)
    .order("full_name");
  if (error) {
    console.error("Error al cargar profesionales:", error);
    throw error;
  }
  return data ?? [];
}
