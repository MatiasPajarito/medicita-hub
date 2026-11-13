export const DEFAULT_JITSI_DOMAIN =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string | undefined> }).env?.[
      "VITE_JITSI_DOMAIN"
    ]?.trim()) ||
  "meet.jit.si";

export type TeleconsultationAvailability =
  | {
      canJoin: true;
      reason: "live" | "early-check" | "completed-window";
      label: string;
    }
  | {
      canJoin: false;
      reason: "cancelled" | "no-show" | "not-telemedicine" | "invalid-schedule";
      label: string;
    };

export interface TeleconsultationRoomConfig {
  roomName: string;
  roomUrl: string;
  embedUrl: string;
  domain: string;
}

export interface WebRTCSupportStatus {
  supported: boolean;
  hasMediaDevices: boolean;
  hasRTCPeerConnection: boolean;
  secureContext: boolean;
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function sanitizeSegment(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return cleaned.slice(0, 12) || "cita";
}

/**
 * Derives a deterministic, non-trivial room name for a telemedicine appointment
 * so patient and doctor always land in the same private Jitsi room without
 * requiring an extra database column.
 */
export function buildTeleconsultationRoomName(
  appointmentId: string,
  scheduledAt?: string | null,
): string {
  const cleanId = sanitizeSegment(appointmentId);
  const signatureA = fnv1a32(`medicita:${appointmentId}:room`);
  const signatureB = fnv1a32(`${scheduledAt ?? "cl"}:${appointmentId}:v1`);
  return `MediCita-${cleanId}-${signatureA}${signatureB}`;
}

export interface BuildRoomUrlOptions {
  appointmentId: string;
  scheduledAt?: string | null;
  participantName?: string | null;
  domain?: string;
  startWithAudioMuted?: boolean;
  startWithVideoMuted?: boolean;
}

/**
 * Builds both the standalone room URL and an embed-friendly Jitsi URL
 * configured for clinical privacy (no prejoin friction when coming from
 * our WebRTC hardware check, deep-linking disabled, branding hidden).
 */
export function buildTeleconsultationRoomConfig(
  options: BuildRoomUrlOptions,
): TeleconsultationRoomConfig {
  const domain = (options.domain || DEFAULT_JITSI_DOMAIN)
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");

  const roomName = buildTeleconsultationRoomName(options.appointmentId, options.scheduledAt);
  const baseUrl = `https://${domain}/${roomName}`;

  const hashParams: string[] = [
    `config.prejoinConfig.enabled=false`,
    `config.disableDeepLinking=true`,
    `config.startWithAudioMuted=${Boolean(options.startWithAudioMuted)}`,
    `config.startWithVideoMuted=${Boolean(options.startWithVideoMuted)}`,
    `config.subject=${encodeURIComponent("Videoconsulta MediCita")}`,
    `interfaceConfig.SHOW_JITSI_WATERMARK=false`,
    `interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false`,
    `interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=false`,
  ];

  const cleanParticipant = options.participantName?.trim();
  if (cleanParticipant) {
    hashParams.push(`userInfo.displayName=${encodeURIComponent(cleanParticipant)}`);
  }

  return {
    roomName,
    roomUrl: baseUrl,
    embedUrl: `${baseUrl}#${hashParams.join("&")}`,
    domain,
  };
}

/**
 * Determines whether a participant may enter a teleconsultation room based on
 * appointment modality, status and timing.
 */
export function getTeleconsultationAvailability(
  params: {
    modality: string;
    status: string | null | undefined;
    scheduledAt: string;
  },
  now: Date = new Date(),
): TeleconsultationAvailability {
  if (params.modality !== "telemedicina") {
    return {
      canJoin: false,
      reason: "not-telemedicine",
      label: "Esta cita es presencial y no cuenta con sala virtual.",
    };
  }

  const normalizedStatus = (params.status ?? "agendada").toLowerCase();
  if (normalizedStatus === "cancelada" || normalizedStatus === "cancelled") {
    return {
      canJoin: false,
      reason: "cancelled",
      label: "La cita fue cancelada; la sala virtual está cerrada.",
    };
  }

  if (normalizedStatus === "no_asistio" || normalizedStatus === "no_show") {
    return {
      canJoin: false,
      reason: "no-show",
      label: "Cita marcada como inasistencia.",
    };
  }

  const scheduledDate = new Date(params.scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    return {
      canJoin: false,
      reason: "invalid-schedule",
      label: "Horario de cita inválido.",
    };
  }

  const diffMinutes = (scheduledDate.getTime() - now.getTime()) / 60_000;

  // Live window: from 30 minutes before until 90 minutes after scheduled time
  if (diffMinutes <= 30 && diffMinutes >= -90) {
    return {
      canJoin: true,
      reason: "live",
      label: "Sala disponible para iniciar videoconsulta.",
    };
  }

  if (diffMinutes > 30) {
    return {
      canJoin: true,
      reason: "early-check",
      label: "Puedes ingresar a probar cámara y audio antes de la hora programada.",
    };
  }

  return {
    canJoin: true,
    reason: "completed-window",
    label:
      normalizedStatus === "completada" || normalizedStatus === "completed"
        ? "Consulta finalizada; acceso en modo de revisión."
        : "El horario programado ya pasó; sala aún accesible.",
  };
}

/**
 * Inspects browser WebRTC & MediaDevices capabilities safely (SSR-friendly).
 */
export function checkWebRTCSupport(
  env: {
    mediaDevices?: Pick<MediaDevices, "getUserMedia"> | null;
    RTCPeerConnection?: unknown;
    isSecureContext?: boolean;
  } | null = typeof window !== "undefined"
    ? {
        mediaDevices: navigator?.mediaDevices ?? null,
        RTCPeerConnection: typeof RTCPeerConnection !== "undefined" ? RTCPeerConnection : undefined,
        isSecureContext:
          typeof window.isSecureContext === "boolean" ? window.isSecureContext : true,
      }
    : null,
): WebRTCSupportStatus {
  if (!env) {
    return {
      supported: false,
      hasMediaDevices: false,
      hasRTCPeerConnection: false,
      secureContext: false,
    };
  }

  const hasMediaDevices = Boolean(
    env.mediaDevices && typeof env.mediaDevices.getUserMedia === "function",
  );
  const hasRTCPeerConnection = Boolean(env.RTCPeerConnection);
  const secureContext = env.isSecureContext !== false;

  return {
    supported: hasMediaDevices && hasRTCPeerConnection && secureContext,
    hasMediaDevices,
    hasRTCPeerConnection,
    secureContext,
  };
}

/**
 * Formats an elapsed session duration in seconds as MM:SS or HH:MM:SS.
 */
export function formatCallDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
