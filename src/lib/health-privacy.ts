export const HEALTH_PRIVACY_POLICY_VERSION = "CL-2026.1";

export const APPLICABLE_LAWS = [
  {
    code: "Ley N° 19.628",
    title: "Protección de la Vida Privada y Datos Personales",
    summary:
      "Exige consentimiento expreso e informado para el tratamiento de datos sensibles de salud y garantiza derechos de acceso, rectificación, cancelación y oposición (ARCO).",
  },
  {
    code: "Ley N° 20.584",
    title: "Derechos y Deberes de las Personas en Atención de Salud",
    summary:
      "Establece la reserva legal de la ficha clínica (Art. 12 y 13), su conservación mínima por 15 años y el acceso exclusivo a personal autorizado o al titular.",
  },
  {
    code: "Ley N° 21.668",
    title: "Interoperabilidad de Fichas Clínicas y Telemedicina",
    summary:
      "Regula el estándar de seguridad, trazabilidad, confidencialidad y consentimiento para atenciones médicas remotas y registro electrónico.",
  },
] as const;

export interface HealthConsentRecord {
  accepted: boolean;
  version: string;
  acceptedAt: string;
  scope: ("ficha_clinica" | "telemedicina" | "tratamiento_datos")[];
  lawReference: string;
  telemedicineRevokedAt?: string | null;
}

/**
 * Builds a structured audit consent record stored in user metadata upon signup
 * or explicit confirmation.
 */
export function createHealthConsentRecord(
  acceptedAt: Date = new Date(),
  includeTelemedicine = true,
): HealthConsentRecord {
  const scope: HealthConsentRecord["scope"] = ["tratamiento_datos", "ficha_clinica"];
  if (includeTelemedicine) {
    scope.push("telemedicina");
  }

  return {
    accepted: true,
    version: HEALTH_PRIVACY_POLICY_VERSION,
    acceptedAt: acceptedAt.toISOString(),
    scope,
    lawReference: "Ley N° 19.628 / Ley N° 20.584 / Ley N° 21.668",
    telemedicineRevokedAt: null,
  };
}

/**
 * Records withdrawal of telemedicine consent (ARCO opposition / revocation)
 * while retaining statutory clinical data processing metadata.
 */
export function revokeTelemedicineConsent(
  current: HealthConsentRecord | null,
  revokedAt: Date = new Date(),
): HealthConsentRecord {
  return {
    accepted: current?.accepted ?? true,
    version: current?.version ?? HEALTH_PRIVACY_POLICY_VERSION,
    acceptedAt: current?.acceptedAt ?? revokedAt.toISOString(),
    scope: ["tratamiento_datos", "ficha_clinica"],
    lawReference: current?.lawReference ?? "Ley N° 19.628 / Ley N° 20.584 / Ley N° 21.668",
    telemedicineRevokedAt: revokedAt.toISOString(),
  };
}

/**
 * Reads consent state safely from Supabase user metadata (which may be typed loosely).
 */
export function extractHealthConsentFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): HealthConsentRecord | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata["health_privacy_consent"];
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Partial<HealthConsentRecord>;
  if (
    candidate.accepted !== true ||
    typeof candidate.version !== "string" ||
    typeof candidate.acceptedAt !== "string"
  ) {
    return null;
  }

  return {
    accepted: true,
    version: candidate.version,
    acceptedAt: candidate.acceptedAt,
    scope: Array.isArray(candidate.scope)
      ? candidate.scope
      : ["tratamiento_datos", "ficha_clinica"],
    lawReference:
      typeof candidate.lawReference === "string"
        ? candidate.lawReference
        : "Ley N° 19.628 / Ley N° 20.584",
    telemedicineRevokedAt:
      typeof candidate.telemedicineRevokedAt === "string" ? candidate.telemedicineRevokedAt : null,
  };
}

export interface ExportablePatientProfile {
  full_name: string;
  rut_dni: string;
  email: string;
  phone?: string | null;
  birth_date?: string | null;
  blood_type?: string | null;
  allergies?: string | null;
  chronic_conditions?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  medical_history_notes?: string | null;
}

export interface ExportableAppointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  modality: string;
  status: string | null;
  doctor_name?: string | null;
  specialty?: string | null;
}

export interface ExportableClinicalNote {
  id: string;
  appointment_id: string;
  created_at: string;
  updated_at?: string | null;
  diagnosis: string;
  treatment_plan: string;
  prescriptions: string | null;
  observations: string | null;
}

export interface PatientClinicalExportPayload {
  schema: "medicita.arcor.v1";
  exportedAt: string;
  legalBasis: string;
  consent: HealthConsentRecord | null;
  patient: ExportablePatientProfile;
  appointments: ExportableAppointment[];
  clinicalNotes: ExportableClinicalNote[];
}

/**
 * Packages the patient's personal data, appointments and clinical notes into
 * a portable JSON structure satisfying ARCO / Ley 20.584 access rights.
 */
export function buildPatientDataExport(input: {
  patient: ExportablePatientProfile;
  appointments: ExportableAppointment[];
  clinicalNotes: ExportableClinicalNote[];
  consent: HealthConsentRecord | null;
  exportedAt?: Date;
}): PatientClinicalExportPayload {
  return {
    schema: "medicita.arcor.v1",
    exportedAt: (input.exportedAt ?? new Date()).toISOString(),
    legalBasis:
      "Portabilidad y derecho de acceso del titular (Ley N° 19.628 Art. 12 y Ley N° 20.584 Art. 13).",
    consent: input.consent,
    patient: {
      full_name: input.patient.full_name,
      rut_dni: input.patient.rut_dni,
      email: input.patient.email,
      phone: input.patient.phone ?? null,
      birth_date: input.patient.birth_date ?? null,
      blood_type: input.patient.blood_type ?? null,
      allergies: input.patient.allergies ?? null,
      chronic_conditions: input.patient.chronic_conditions ?? null,
      emergency_contact_name: input.patient.emergency_contact_name ?? null,
      emergency_contact_phone: input.patient.emergency_contact_phone ?? null,
      medical_history_notes: input.patient.medical_history_notes ?? null,
    },
    appointments: [...input.appointments],
    clinicalNotes: [...input.clinicalNotes],
  };
}

/**
 * Generates a sanitized filename for the patient's downloaded clinical archive.
 */
export function buildPatientExportFilename(rutOrName: string, date: Date = new Date()): string {
  const safeId =
    rutOrName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "paciente";
  const day = date.toISOString().slice(0, 10);
  return `medicita-ficha-datos-${safeId}-${day}.json`;
}
