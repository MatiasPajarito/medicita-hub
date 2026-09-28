import { z } from "zod";

export const specialties = ["Medicina General", "Pediatría", "Cardiología", "Salud Mental", "Dermatología", "Ginecología"] as const;
export const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export function normalizeRut(value: string) {
  const clean = value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return value.trim().toUpperCase();
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1);
  return `${Number(body).toLocaleString("es-CL")}-${verifier}`;
}

export function isValidChileanRut(value: string) {
  const clean = value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  const expected = result === 11 ? "0" : result === 10 ? "K" : String(result);
  return verifier === expected;
}

const optionalText = (max: number) => z.string().trim().max(max);

export const patientSchema = z.object({
  full_name: z.string().trim().min(2, "Ingresa tu nombre completo").max(120),
  rut_dni: z.string().trim().refine(isValidChileanRut, "Ingresa un RUT chileno válido"),
  email: z.string().trim().email("Ingresa un correo válido").max(255),
  phone: z.string().trim().min(7, "Ingresa un teléfono válido").max(30),
  birth_date: z.string().date("Ingresa una fecha válida").refine((date) => new Date(`${date}T00:00:00`) <= new Date(), "La fecha no puede estar en el futuro"),
  blood_type: z.enum(bloodTypes).or(z.literal("")),
  emergency_contact_name: optionalText(120),
  emergency_contact_phone: optionalText(30),
  allergies: optionalText(2000),
  chronic_conditions: optionalText(2000),
  medical_history_notes: optionalText(5000),
});
export type PatientInput = z.infer<typeof patientSchema>;

export const doctorSchema = z.object({
  full_name: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  specialty: z.enum(specialties, { required_error: "Selecciona una especialidad" }),
  bio: z.string().trim().min(10, "La biografía debe tener al menos 10 caracteres").max(1000),
  photo_url: z.string().trim().url("Ingresa una URL válida").max(1000).or(z.literal("")),
  consultation_fee: z.number().int().min(0, "La tarifa no puede ser negativa").max(10000000),
  is_active: z.boolean(),
});
export type DoctorInput = z.infer<typeof doctorSchema>;
