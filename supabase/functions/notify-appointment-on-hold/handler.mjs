const isOnHold = (status) =>
  typeof status === "string" && status.trim().toLowerCase().replace(/[ -]/g, "_") === "on_hold";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

export function renderOnHoldEmail(appointment, patient) {
  const fields = [
    ["ID de la cita", appointment.id],
    ["Fecha", `${appointment.appointment_date} ${appointment.start_time} (America/Santiago)`],
    ["Cliente", patient.full_name],
    ["Estado", "En espera (On Hold)"],
  ];
  if (appointment.on_hold_reason) fields.push(["Motivo", appointment.on_hold_reason]);
  return {
    subject: "Tu cita está en espera — MediCita",
    text: `Tu cita está en espera.\n\n${fields.map(([key, value]) => `${key}: ${value}`).join("\n")}\n\nTe informaremos cuando haya novedades.\nMediCita`,
    html: `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#172b4d;background:#f5f7fa;padding:24px"><main style="max-width:560px;margin:auto;background:white;padding:28px;border-radius:8px"><h1 style="font-size:22px">Tu cita está en espera</h1><p>Estos son los datos de tu cita:</p><dl>${fields.map(([key, value]) => `<dt style="font-weight:bold;margin-top:12px">${escapeHtml(key)}</dt><dd style="margin:4px 0">${escapeHtml(value)}</dd>`).join("")}</dl><p>Te informaremos cuando haya novedades.</p><p>MediCita</p></main></body></html>`,
  };
}

// Dependencies are injected so error paths can be tested without sending mail.
export function createOnHoldHandler({ env, fetchImpl = fetch, log = console.error }) {
  return async (request) => {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const secret = env("ON_HOLD_WEBHOOK_SECRET");
    if (!secret) return new Response(null, { status: 503 });
    if (request.headers.get("x-on-hold-secret") !== secret) return new Response(null, { status: 401 });

    let event;
    try { event = await request.json(); }
    catch { return new Response(null, { status: 400 }); }
    if (!event || event.type !== "UPDATE" || event.schema !== "public" || event.table !== "appointments") {
      return new Response(null, { status: 400 });
    }
    const appointment = event.record;
    if (!appointment || !event.old_record || typeof event.old_record.status !== "string") {
      return new Response(null, { status: 400 });
    }
    if (!isOnHold(appointment.status) || isOnHold(event.old_record.status)) {
      return new Response(null, { status: 204 });
    }
    if (![event.event_id, appointment.id, appointment.patient_id, appointment.appointment_date, appointment.start_time]
      .every((value) => typeof value === "string" && value.length > 0)) {
      return new Response(null, { status: 400 });
    }

    try {
      const required = (name) => {
        const value = env(name);
        if (!value) throw new Error("configuration");
        return value;
      };
      const apiKey = required("RESEND_API_KEY");
      const from = required("ON_HOLD_EMAIL_FROM");
      const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
      const url = new URL("/rest/v1/patients", required("SUPABASE_URL"));
      url.searchParams.set("id", `eq.${appointment.patient_id}`);
      url.searchParams.set("select", "full_name,email");
      const patientResponse = await fetchImpl(url, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!patientResponse.ok) throw new Error("patient_lookup");
      const patients = await patientResponse.json();
      if (patients.length !== 1 || !patients[0].email || !patients[0].full_name) throw new Error("patient_missing");
      const patient = patients[0];
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `appointment-on-hold/${event.event_id}`,
        },
        body: JSON.stringify({ from, to: [patient.email], ...renderOnHoldEmail(appointment, patient) }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("email_provider");
      return new Response(null, { status: 204 });
    } catch {
      // Do not expose email addresses, clinical details, credentials or provider bodies.
      log("on_hold_notification_failed", { eventId: event.event_id });
      return new Response(null, { status: 502 });
    }
  };
}
