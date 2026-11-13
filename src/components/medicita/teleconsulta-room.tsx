import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  ShieldCheck,
  Video,
  VideoOff,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  buildTeleconsultationRoomConfig,
  checkWebRTCSupport,
  formatCallDuration,
  getTeleconsultationAvailability,
} from "@/lib/telemedicine";
import { cn } from "@/lib/utils";

export interface TeleconsultaAppointmentSummary {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  modality: string;
  status: string;
  bookingCode?: string | null | undefined;
  doctorName: string;
  doctorSpecialty: string;
  patientName: string;
  patientRut?: string | null | undefined;
}

export interface TeleconsultaRoomProps {
  appointment: TeleconsultaAppointmentSummary;
  participantName: string;
  viewerRole: "doctor" | "patient" | "admin";
  backTo: "/mi-agenda" | "/doctor/citas" | "/admin";
  onOpenClinicalNote?: (() => void) | undefined;
  hasExistingNote?: boolean | undefined;
}

type MediaTestState = "idle" | "requesting" | "ready" | "denied" | "unsupported";

export function TeleconsultaRoom({
  appointment,
  participantName,
  viewerRole,
  backTo,
  onOpenClinicalNote,
  hasExistingNote,
}: TeleconsultaRoomProps) {
  const scheduledAtIso = `${appointment.appointment_date}T${appointment.start_time}`;
  const availability = useMemo(
    () =>
      getTeleconsultationAvailability({
        modality: appointment.modality,
        status: appointment.status,
        scheduledAt: scheduledAtIso,
      }),
    [appointment.modality, appointment.status, scheduledAtIso],
  );

  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [teleConsentAccepted, setTeleConsentAccepted] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [mediaState, setMediaState] = useState<MediaTestState>("idle");
  const [mediaError, setMediaError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const webrtcSupport = useMemo(() => checkWebRTCSupport(), []);

  const roomConfig = useMemo(
    () =>
      buildTeleconsultationRoomConfig({
        appointmentId: appointment.id,
        scheduledAt: scheduledAtIso,
        participantName,
        startWithAudioMuted: audioMuted,
        startWithVideoMuted: videoMuted,
      }),
    [appointment.id, scheduledAtIso, participantName, audioMuted, videoMuted],
  );

  const stopPreviewStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, []);

  const startMediaCheck = useCallback(async () => {
    if (!webrtcSupport.hasMediaDevices) {
      setMediaState("unsupported");
      setMediaError(
        "Tu navegador o contexto actual no permite acceder a cámara y micrófono mediante WebRTC.",
      );
      return;
    }

    stopPreviewStream();
    setMediaState("requesting");
    setMediaError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;

      for (const track of stream.getAudioTracks()) {
        track.enabled = !audioMuted;
      }
      for (const track of stream.getVideoTracks()) {
        track.enabled = !videoMuted;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setMediaState("ready");
    } catch (err) {
      setMediaState("denied");
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name: unknown }).name)
          : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMediaError(
          "Permiso denegado para cámara o micrófono. Habilítalos en el candado de la barra de direcciones e inténtalo de nuevo.",
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setMediaError(
          "No detectamos cámara o micrófono conectados. Puedes ingresar igualmente con audio/video desactivado.",
        );
      } else {
        setMediaError(
          "No pudimos inicializar la vista previa local. Aun así puedes conectarte a la sala o abrirla en otra pestaña.",
        );
      }
    }
  }, [webrtcSupport.hasMediaDevices, stopPreviewStream, audioMuted, videoMuted]);

  useEffect(() => {
    if (!availability.canJoin || inCall) return;
    void startMediaCheck();
    return () => {
      stopPreviewStream();
    };
  }, [availability.canJoin, inCall, startMediaCheck, stopPreviewStream]);

  useEffect(() => {
    if (!streamRef.current) return;
    for (const track of streamRef.current.getAudioTracks()) {
      track.enabled = !audioMuted;
    }
    for (const track of streamRef.current.getVideoTracks()) {
      track.enabled = !videoMuted;
    }
  }, [audioMuted, videoMuted]);

  useEffect(() => {
    if (!inCall) {
      setElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [inCall]);

  function handleJoinRoom() {
    if (!teleConsentAccepted) {
      toast.error(
        "Debes confirmar el consentimiento de telemedicina y confidencialidad clínica antes de ingresar.",
      );
      return;
    }
    // Release local WebRTC capture before mounting the embedded Jitsi Meet room
    // so browsers on Windows/Linux do not lock camera access.
    stopPreviewStream();
    setInCall(true);
    toast.success("Conectado a la sala de videoconsulta.");
  }

  function handleLeaveRoom() {
    setInCall(false);
    toast.info("Saliste de la sala de videoconsulta.");
  }

  async function handleCopyRoomLink() {
    try {
      await navigator.clipboard.writeText(roomConfig.roomUrl);
      setCopiedLink(true);
      toast.success("Enlace seguro de la sala copiado.");
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("No se pudo copiar el enlace al portapapeles.");
    }
  }

  const formattedDate = format(parseISO(appointment.appointment_date), "EEEE d 'de' MMMM, yyyy", {
    locale: es,
  });
  const timeRange = `${appointment.start_time.slice(0, 5)} – ${appointment.end_time.slice(0, 5)}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" className="min-h-10 gap-2" asChild>
            <Link to={backTo}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Volver
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Sala de videoconsulta
              </h1>
              <Badge variant={inCall ? "default" : "secondary"} className="gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    inCall ? "bg-emerald-400 animate-pulse" : "bg-primary",
                  )}
                  aria-hidden="true"
                />
                {inCall ? `En curso · ${formatCallDuration(elapsedSeconds)}` : "Sala preparada"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {appointment.doctorName} · {appointment.doctorSpecialty}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewerRole === "doctor" && onOpenClinicalNote && (
            <Button
              type="button"
              onClick={onOpenClinicalNote}
              variant="outline"
              className="min-h-10 gap-2 border-primary/40 text-primary hover:bg-clinical-soft"
            >
              <FileText className="size-4" aria-hidden="true" />
              {hasExistingNote ? "Ver / editar ficha clínica" : "Registrar ficha clínica"}
            </Button>
          )}
          {inCall && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleLeaveRoom}
              className="min-h-10 gap-2"
            >
              <PhoneOff className="size-4" aria-hidden="true" />
              Finalizar sesión
            </Button>
          )}
        </div>
      </div>

      {!availability.canJoin ? (
        <Card className="border-destructive/40 bg-card">
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="size-6 shrink-0" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Videoconsulta no disponible</h2>
            </div>
            <p className="text-sm text-foreground">{availability.label}</p>
            <Button asChild variant="default">
              <Link to={backTo}>Regresar a mi agenda</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section
            aria-label={inCall ? "Videoconsulta en vivo" : "Prueba previa WebRTC"}
            className="space-y-4"
          >
            {inCall ? (
              <div className="overflow-hidden rounded-xl border border-border bg-slate-950 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
                    <span>
                      Sesión cifrada · Sala privada{" "}
                      <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-100">
                        {roomConfig.roomName}
                      </code>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-slate-200 hover:bg-slate-800 hover:text-white"
                      onClick={() => void handleCopyRoomLink()}
                    >
                      {copiedLink ? (
                        <Check className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="size-3.5" aria-hidden="true" />
                      )}
                      {copiedLink ? "Copiado" : "Copiar enlace"}
                    </Button>
                    <a
                      href={roomConfig.roomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 px-2.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      Abrir aparte
                    </a>
                  </div>
                </div>
                <iframe
                  title={`Videoconsulta clínica con ${viewerRole === "doctor" ? appointment.patientName : appointment.doctorName}`}
                  src={roomConfig.embedUrl}
                  allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                  allowFullScreen
                  className="h-[540px] w-full border-0 bg-slate-950 sm:h-[620px]"
                />
                <div className="border-t border-slate-800 bg-slate-900/95 px-4 py-2 text-xs text-slate-300">
                  Si el navegador bloquea la incrustación o la sala solicita iniciar sesión como
                  moderador, presiona <strong>Abrir aparte</strong> en la esquina superior derecha.
                </div>
              </div>
            ) : (
              <Card className="overflow-hidden border-border bg-card shadow-card">
                <CardHeader className="border-b border-border bg-surface-subtle/60 pb-4">
                  <CardTitle className="flex items-center justify-between gap-2 text-base font-semibold">
                    <span>Verificación WebRTC previa (cámara y micrófono)</span>
                    <Badge variant="outline" className="text-xs">
                      {mediaState === "ready"
                        ? "Dispositivos listos"
                        : mediaState === "requesting"
                          ? "Solicitando acceso..."
                          : "Modo alternativo"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-slate-950">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      aria-label="Vista previa de tu cámara local"
                      className={cn(
                        "h-full w-full object-cover transition-opacity",
                        videoMuted || mediaState !== "ready" ? "opacity-0" : "opacity-100",
                      )}
                    />
                    {(videoMuted || mediaState !== "ready") && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-slate-200">
                        <VideoOff className="size-10 text-slate-400" aria-hidden="true" />
                        <p className="text-sm font-medium">
                          {mediaState === "requesting"
                            ? "Solicitando permiso de cámara y micrófono..."
                            : videoMuted
                              ? "Tu cámara está desactivada para el ingreso"
                              : (mediaError ?? "Cámara sin vista previa activa.")}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p role="status" aria-live="polite" className="sr-only">
                      {audioMuted ? "Micrófono silenciado." : "Micrófono activo."}{" "}
                      {videoMuted ? "Cámara apagada." : "Cámara activa."}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant={audioMuted ? "destructive" : "outline"}
                        className="min-h-11 gap-2"
                        aria-pressed={audioMuted}
                        onClick={() => setAudioMuted((prev) => !prev)}
                      >
                        {audioMuted ? (
                          <MicOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Mic className="size-4" aria-hidden="true" />
                        )}
                        {audioMuted ? "Micrófono silenciado" : "Micrófono activo"}
                      </Button>

                      <Button
                        type="button"
                        variant={videoMuted ? "destructive" : "outline"}
                        className="min-h-11 gap-2"
                        aria-pressed={videoMuted}
                        onClick={() => setVideoMuted((prev) => !prev)}
                      >
                        {videoMuted ? (
                          <VideoOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Video className="size-4" aria-hidden="true" />
                        )}
                        {videoMuted ? "Cámara apagada" : "Cámara activa"}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 gap-2"
                        onClick={() => void startMediaCheck()}
                      >
                        <RefreshCw className="size-4" aria-hidden="true" />
                        Reintentar prueba
                      </Button>
                    </div>
                  </div>

                  {mediaError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
                    >
                      {mediaError}
                    </div>
                  )}

                  <div className="rounded-lg border border-primary/25 bg-clinical-soft/45 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="teleconsulta-consent"
                        checked={teleConsentAccepted}
                        onCheckedChange={(checked) => setTeleConsentAccepted(checked === true)}
                        aria-describedby="teleconsulta-consent-desc"
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor="teleconsulta-consent"
                          className="cursor-pointer text-sm font-semibold leading-snug text-foreground"
                        >
                          Confirmo atención por telemedicina en ambiente privado
                        </Label>
                        <p
                          id="teleconsulta-consent-desc"
                          className="text-xs leading-relaxed text-muted-foreground"
                        >
                          Conforme a la Ley N° 20.584 y Ley N° 21.668, esta videoconsulta es
                          confidencial, no será grabada sin autorización expresa y la atención
                          clínica quedará resguardada en tu ficha médica.{" "}
                          <Link
                            to="/privacidad"
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            Ver política de datos de salud
                          </Link>
                          .
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <Button
                        type="button"
                        size="lg"
                        onClick={handleJoinRoom}
                        disabled={!teleConsentAccepted}
                        className="min-h-11 gap-2 font-semibold"
                      >
                        <Video className="size-4" aria-hidden="true" />
                        Ingresar a la videoconsulta
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="min-h-11 gap-2"
                        onClick={() => void handleCopyRoomLink()}
                      >
                        {copiedLink ? (
                          <Check className="size-4" aria-hidden="true" />
                        ) : (
                          <Copy className="size-4" aria-hidden="true" />
                        )}
                        {copiedLink ? "Enlace copiado" : "Copiar enlace de sala"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>

          <aside aria-label="Detalles de la cita" className="space-y-4">
            <Card className="border-border bg-card shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Resumen de la consulta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Profesional
                  </p>
                  <p className="font-semibold text-foreground">{appointment.doctorName}</p>
                  <p className="text-xs text-muted-foreground">{appointment.doctorSpecialty}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Paciente
                  </p>
                  <p className="font-semibold text-foreground">{appointment.patientName}</p>
                  {appointment.patientRut && (
                    <p className="text-xs text-muted-foreground">RUT: {appointment.patientRut}</p>
                  )}
                </div>

                <div className="space-y-1.5 border-t border-border pt-3 text-xs text-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                    <span className="capitalize">{formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="size-4 text-primary" aria-hidden="true" />
                    <span>{timeRange} hrs</span>
                  </div>
                </div>

                {appointment.bookingCode && (
                  <div className="rounded-md border border-border bg-surface-subtle/60 p-3 text-xs">
                    <p className="mb-1 font-semibold text-foreground">Código de reserva</p>
                    <p className="font-mono text-foreground">{appointment.bookingCode}</p>
                  </div>
                )}

                <div className="rounded-md border border-border bg-clinical-soft/35 p-3 text-xs text-foreground">
                  <p className="font-semibold text-primary">Estado de disponibilidad</p>
                  <p className="mt-1 text-muted-foreground">{availability.label}</p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
