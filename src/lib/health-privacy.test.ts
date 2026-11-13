import { describe, expect, it } from "vitest";
import {
  APPLICABLE_LAWS,
  HEALTH_PRIVACY_POLICY_VERSION,
  buildPatientDataExport,
  buildPatientExportFilename,
  createHealthConsentRecord,
  extractHealthConsentFromMetadata,
  revokeTelemedicineConsent,
} from "./health-privacy";

describe("health-privacy compliance helpers", () => {
  it("documents the three applicable Chilean health and data laws", () => {
    const codes = APPLICABLE_LAWS.map((law) => law.code);
    expect(codes).toContain("Ley N° 19.628");
    expect(codes).toContain("Ley N° 20.584");
    expect(codes).toContain("Ley N° 21.668");
  });

  it("creates structured consent records with explicit version and timestamp", () => {
    const fixedDate = new Date("2026-11-13T12:00:00.000Z");
    const record = createHealthConsentRecord(fixedDate, true);

    expect(record).toEqual({
      accepted: true,
      version: HEALTH_PRIVACY_POLICY_VERSION,
      acceptedAt: "2026-11-13T12:00:00.000Z",
      scope: ["tratamiento_datos", "ficha_clinica", "telemedicina"],
      lawReference: "Ley N° 19.628 / Ley N° 20.584 / Ley N° 21.668",
      telemedicineRevokedAt: null,
    });

    const withoutTele = createHealthConsentRecord(fixedDate, false);
    expect(withoutTele.scope).toEqual(["tratamiento_datos", "ficha_clinica"]);
  });

  it("revokes telemedicine consent while preserving statutory clinical record basis", () => {
    const grantedAt = new Date("2026-11-10T10:00:00.000Z");
    const revokedAt = new Date("2026-11-13T14:00:00.000Z");
    const initial = createHealthConsentRecord(grantedAt, true);
    const updated = revokeTelemedicineConsent(initial, revokedAt);

    expect(updated.accepted).toBe(true);
    expect(updated.scope).toEqual(["tratamiento_datos", "ficha_clinica"]);
    expect(updated.telemedicineRevokedAt).toBe("2026-11-13T14:00:00.000Z");
  });

  it("extracts valid consent records from Supabase user metadata and rejects invalid shapes", () => {
    expect(extractHealthConsentFromMetadata(null)).toBeNull();
    expect(extractHealthConsentFromMetadata({})).toBeNull();
    expect(
      extractHealthConsentFromMetadata({
        health_privacy_consent: { accepted: false },
      }),
    ).toBeNull();

    const valid = createHealthConsentRecord(new Date("2026-11-10T10:00:00Z"));
    expect(extractHealthConsentFromMetadata({ health_privacy_consent: valid })).toEqual(valid);
  });

  it("builds a complete ARCO / Ley 20.584 portable JSON export payload", () => {
    const exportedAt = new Date("2026-11-13T15:00:00.000Z");
    const consent = createHealthConsentRecord(exportedAt);
    const payload = buildPatientDataExport({
      consent,
      exportedAt,
      patient: {
        full_name: "Camila Soto",
        rut_dni: "18.456.789-K",
        email: "camila@ejemplo.cl",
        blood_type: "O+",
      },
      appointments: [
        {
          id: "apt-1",
          appointment_date: "2026-11-14",
          start_time: "11:00:00",
          end_time: "11:30:00",
          modality: "telemedicina",
          status: "agendada",
          doctor_name: "Dr. Juan Lagos",
          specialty: "Cardiología",
          booking_code: "MC-001",
          order_code: "ORD-001",
        },
      ],
      clinicalNotes: [
        {
          id: "note-1",
          appointment_id: "apt-1",
          created_at: "2026-11-14T11:30:00Z",
          diagnosis: "Normotenso",
          treatment_plan: "Control en 6 meses",
          prescriptions: null,
          observations: "Sin síntomas agudos",
        },
      ],
    });

    expect(payload.schema).toBe("medicita.arcor.v1");
    expect(payload.exportedAt).toBe("2026-11-13T15:00:00.000Z");
    expect(payload.legalBasis).toContain("Ley N° 19.628");
    expect(payload.legalBasis).toContain("Ley N° 20.584");
    expect(payload.patient.phone).toBeNull();
    expect(payload.appointments).toHaveLength(1);
    expect(payload.clinicalNotes).toHaveLength(1);
  });

  it("generates sanitized export filenames", () => {
    const file = buildPatientExportFilename("18.456.789-K", new Date("2026-11-13T10:00:00Z"));
    expect(file).toBe("medicita-ficha-datos-18-456-789-k-2026-11-13.json");
  });
});
