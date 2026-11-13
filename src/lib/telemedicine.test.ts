import { describe, expect, it } from "vitest";
import {
  buildTeleconsultationRoomConfig,
  buildTeleconsultationRoomName,
  checkWebRTCSupport,
  formatCallDuration,
  getTeleconsultationAvailability,
} from "./telemedicine";

describe("telemedicine helpers", () => {
  it("generates deterministic, room-safe names for an appointment", () => {
    const id = "9f8b2c10-4e21-4d8a-9f44-1234567890ab";
    const sched = "2026-11-15T14:30:00-03:00";

    const roomA = buildTeleconsultationRoomName(id, sched);
    const roomB = buildTeleconsultationRoomName(id, sched);
    const roomDifferent = buildTeleconsultationRoomName(
      "00000000-0000-0000-0000-000000000001",
      sched,
    );

    expect(roomA).toBe(roomB);
    expect(roomA).not.toBe(roomDifferent);
    expect(roomA).toMatch(/^MediCita-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("builds valid Jitsi embed and standalone URLs with participant name and mute flags", () => {
    const config = buildTeleconsultationRoomConfig({
      appointmentId: "apt-123",
      scheduledAt: "2026-11-15T14:30:00Z",
      participantName: "Dra. Ana Pérez",
      startWithAudioMuted: true,
      startWithVideoMuted: false,
    });

    expect(config.domain).toBe("meet.jit.si");
    expect(config.roomUrl).toBe(`https://meet.jit.si/${config.roomName}`);
    expect(config.embedUrl).toContain("config.prejoinConfig.enabled=false");
    expect(config.embedUrl).toContain("config.startWithAudioMuted=true");
    expect(config.embedUrl).toContain("config.startWithVideoMuted=false");
    expect(config.embedUrl).toContain(
      `userInfo.displayName=${encodeURIComponent("Dra. Ana Pérez")}`,
    );
    expect(config.embedUrl).toContain("interfaceConfig.SHOW_JITSI_WATERMARK=false");
  });

  it("normalizes custom Jitsi domains cleanly", () => {
    const config = buildTeleconsultationRoomConfig({
      appointmentId: "apt-456",
      domain: "https://video.medicita.cl///",
    });

    expect(config.domain).toBe("video.medicita.cl");
    expect(config.roomUrl.startsWith("https://video.medicita.cl/MediCita-")).toBe(true);
  });

  it("evaluates teleconsultation availability correctly across statuses and time windows", () => {
    const scheduled = "2026-11-15T15:00:00Z";

    expect(
      getTeleconsultationAvailability({
        modality: "presencial",
        status: "agendada",
        scheduledAt: scheduled,
      }),
    ).toMatchObject({ canJoin: false, reason: "not-telemedicine" });

    expect(
      getTeleconsultationAvailability({
        modality: "telemedicina",
        status: "cancelada",
        scheduledAt: scheduled,
      }),
    ).toMatchObject({ canJoin: false, reason: "cancelled" });

    expect(
      getTeleconsultationAvailability({
        modality: "telemedicina",
        status: "no_asistio",
        scheduledAt: scheduled,
      }),
    ).toMatchObject({ canJoin: false, reason: "no-show" });

    expect(
      getTeleconsultationAvailability(
        {
          modality: "telemedicina",
          status: "agendada",
          scheduledAt: scheduled,
        },
        new Date("2026-11-15T14:45:00Z"),
      ),
    ).toMatchObject({ canJoin: true, reason: "live" });

    expect(
      getTeleconsultationAvailability(
        {
          modality: "telemedicina",
          status: "agendada",
          scheduledAt: scheduled,
        },
        new Date("2026-11-15T10:00:00Z"),
      ),
    ).toMatchObject({ canJoin: true, reason: "early-check" });

    expect(
      getTeleconsultationAvailability(
        {
          modality: "telemedicina",
          status: "completada",
          scheduledAt: scheduled,
        },
        new Date("2026-11-15T18:00:00Z"),
      ),
    ).toMatchObject({ canJoin: true, reason: "completed-window" });
  });

  it("checks WebRTC capability across supported, insecure, and SSR environments", () => {
    expect(checkWebRTCSupport(null)).toEqual({
      supported: false,
      hasMediaDevices: false,
      hasRTCPeerConnection: false,
      secureContext: false,
    });

    expect(
      checkWebRTCSupport({
        mediaDevices: { getUserMedia: async () => ({}) as MediaStream },
        RTCPeerConnection: function MockRTC() {},
        isSecureContext: true,
      }),
    ).toEqual({
      supported: true,
      hasMediaDevices: true,
      hasRTCPeerConnection: true,
      secureContext: true,
    });

    expect(
      checkWebRTCSupport({
        mediaDevices: { getUserMedia: async () => ({}) as MediaStream },
        RTCPeerConnection: function MockRTC() {},
        isSecureContext: false,
      }),
    ).toMatchObject({ supported: false, secureContext: false });
  });

  it("formats elapsed call duration cleanly", () => {
    expect(formatCallDuration(0)).toBe("00:00");
    expect(formatCallDuration(65)).toBe("01:05");
    expect(formatCallDuration(3661)).toBe("01:01:01");
    expect(formatCallDuration(-10)).toBe("00:00");
  });
});
