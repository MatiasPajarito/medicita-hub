import { test } from "node:test";
import assert from "node:assert/strict";
import { createOnHoldHandler, renderOnHoldEmail } from "./handler.mjs";

const event = {
  event_id: "event-1", type: "UPDATE", schema: "public", table: "appointments",
  old_record: { status: "confirmed" },
  record: { id: "appt-1", patient_id: "patient-1", status: "on_hold", appointment_date: "2026-11-10", start_time: "12:00:00" },
};
function setup(fetchImpl) {
  const logs = [];
  const handler = createOnHoldHandler({
    env: (key) => key === "SUPABASE_URL" ? "https://example.supabase.co" : "test-secret",
    fetchImpl, log: (...args) => logs.push(args),
  });
  return { logs, call: (payload = event, secret = "test-secret") => handler(new Request("https://example.com", {
    method: "POST", headers: { "x-on-hold-secret": secret }, body: JSON.stringify(payload),
  })) };
}
test("rechaza solicitudes sin autenticación antes de acceder a datos", async () => {
  const { call } = setup(() => assert.fail("No debe consultar"));
  assert.equal((await call(event, "invalid")).status, 401);
});
test("ignora estados distintos y actualizaciones repetidas de On Hold", async () => {
  const { call } = setup(() => assert.fail("No debe enviar"));
  assert.equal((await call({ ...event, record: { ...event.record, status: "cancelled" } })).status, 204);
  assert.equal((await call({ ...event, old_record: { status: "On Hold" } })).status, 204);
});
test("envía al paciente y conserva la clave para reintentar un evento", async () => {
  const sends = [];
  const { call } = setup(async (url, options) => {
    if (String(url).includes("/patients")) return Response.json([{ email: "patient@example.com", full_name: "Ana" }]);
    sends.push(options);
    return Response.json({ id: "email-1" });
  });
  assert.equal((await call()).status, 204);
  assert.equal((await call()).status, 204);
  assert.equal(sends[0].headers["Idempotency-Key"], sends[1].headers["Idempotency-Key"]);
  assert.deepEqual(JSON.parse(sends[0].body).to, ["patient@example.com"]);
  await call({ ...event, event_id: "event-2" });
  assert.notEqual(sends[0].headers["Idempotency-Key"], sends[2].headers["Idempotency-Key"]);
});
test("contiene errores de proveedor y de red sin lanzar excepciones", async () => {
  for (const networkFailure of [false, true]) {
    const { call, logs } = setup(async (url) => {
      if (String(url).includes("/patients")) return Response.json([{ email: "private@example.com", full_name: "Ana" }]);
      if (networkFailure) throw new Error("private credentials");
      return new Response("private details", { status: 500 });
    });
    assert.equal((await call()).status, 502);
    assert.equal(JSON.stringify(logs).includes("private"), false);
  }
});
test("escapa HTML y solo incluye el motivo cuando existe", () => {
  const patient = { full_name: "<script>alert(1)</script>" };
  const result = renderOnHoldEmail({ ...event.record, on_hold_reason: "<b>Reprogramación</b>" }, patient);
  assert.ok(!result.html.includes("<script>"));
  assert.ok(result.html.includes("&lt;b&gt;Reprogramación&lt;/b&gt;"));
  assert.ok(result.text.includes("appt-1"));
  assert.ok(!renderOnHoldEmail(event.record, patient).text.includes("Motivo"));
});
test("rechaza eventos incompletos sin llamar al proveedor", async () => {
  const { call } = setup(() => assert.fail("No debe consultar"));
  assert.equal((await call({ ...event, event_id: undefined })).status, 400);
  assert.equal((await call(null)).status, 400);
});
