# Notificaciones On Hold

Implementación aislada: solo se añadieron archivos. No se cambiaron dependencias,
componentes, políticas RLS, migraciones históricas ni lógica de reservas.
Destinatario asumido: el paciente/cliente, usando `patients.email`.

## Hallazgo que impide activarlo todavía

El checkout no contiene un flujo On Hold. En
`drizzle/migrations/0000_patient_agenda_and_safe_cancellation.sql`:

- `appointments.status` no admite `on_hold`.
- `validate_patient_appointment` rechaza actualizaciones distintas de cancelación,
  incluso antes de ejecutar este listener.
- La exclusión de horarios y la consulta de bloques ocupados solo consideran los
  estados activos actuales.

Además, `src/routes/_authenticated/doctor/citas.tsx`, en `updateStatusMutation`,
solo acepta `completed | cancelled`. Los helpers de presentación tampoco reconocen
On Hold. No se debe equiparar silenciosamente `scheduled` con On Hold.

Antes de activar, confirmar si el flujo existe en otra rama/base y cuál es su valor
persistido, quién puede activarlo y si conserva ocupado el horario. Si es nuevo,
esas decisiones requieren una migración de negocio y cambios puntuales propios;
este módulo no debilita validadores para eludirlos. No ejecutar un UPDATE de prueba
en producción ni modificar una migración histórica para añadir este estado.

## Integración exacta

No añadir llamadas en el controlador React. Las escrituras actuales pasan directamente
por Supabase; una llamada desde el navegador puede perderse al cerrar la pestaña.
El archivo `install-listener.sql` contiene todas las líneas a añadir en la base:
una función dedicada y un trigger AFTER UPDATE de `appointments.status`.
No reemplaza ninguno de los triggers existentes. Ejecutarlo una sola vez, primero
en staging, una vez verificados los requisitos anteriores. Se entrega fuera del
directorio de migraciones automáticas deliberadamente.

Flujo: UPDATE válido → encolado HTTP en la transacción → COMMIT → pg_net envía
el evento → Edge Function consulta nombre/email → Resend envía HTML y texto.
El HTTP solo se ejecuta tras commit; un rollback no envía correo. Los errores de
encolado se capturan en SQL. Un fallo de consulta, timeout o proveedor devuelve 502
en el worker sin modificar ni revertir la cita. No hay HTTP síncrono dentro del UPDATE.

Se envía exclusivamente al entrar en `on_hold` (también reconoce `On Hold` y
`on-hold`); actualizar otro dato o volver a guardar el mismo estado no envía otro
correo. Cada nueva entrada tiene un UUID distinto. El motivo opcional se toma de
`on_hold_reason` si existe, sin reutilizar notas clínicas privadas.

## Configuración y despliegue

Secretos de la Edge Function (nunca usar prefijo VITE ni guardarlos en Git):

| Variable | Valor |
| --- | --- |
| `RESEND_API_KEY` | API key de Resend con permiso de envío |
| `ON_HOLD_EMAIL_FROM` | `MediCita <citas@dominio-verificado.example>`; verificar el dominio real en Resend |
| `ON_HOLD_WEBHOOK_SECRET` | Secreto aleatorio largo exclusivo de este listener |
| `SUPABASE_URL` | Disponible en el entorno de Supabase Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Disponible en el servidor; jamás exponer al navegador |

Cargar los tres primeros mediante Supabase Secrets. Desplegar:

```sh
supabase functions deploy notify-appointment-on-hold --no-verify-jwt
```

La función valida `x-on-hold-secret` antes de leer datos o enviar correo, por eso
no usa un JWT de usuario. No crear además un Database Webhook genérico: este
listener construye el `event_id` requerido y evita duplicar los envíos.

Crear en Supabase Vault, usando su interfaz, estos secretos:

- `on_hold_webhook_url`: `https://<project-ref>.supabase.co/functions/v1/notify-appointment-on-hold`
- `on_hold_webhook_secret`: el mismo valor que `ON_HOLD_WEBHOOK_SECRET`.

Habilitar Vault si no está disponible. Después ejecutar `install-listener.sql`
con el rol de administración de migraciones. Revisar que los roles de la aplicación
no puedan leer las colas/cabeceras de pg_net ni los secretos descifrados de Vault.

## Verificación y límites

Pruebas locales sin credenciales, dependencias ni envío real:

```sh
node --test supabase/functions/notify-appointment-on-hold/handler.test.mjs
```

En staging comprobar: entrada en On Hold genera un correo; cambios dentro de On
Hold no envían; salida y nueva entrada generan otro; proveedor caído mantiene la
cita en On Hold; rollback no envía; encabezado inválido devuelve 401.

Resend deduplica reintentos con el mismo `event_id` durante su ventana de idempotencia
(24 horas). El UUID debe conservarse al repetir el mismo evento. No hay garantía
de entrega exactamente una vez, cola durable ni reintentos automáticos en esta
versión mínima. Revisar fallos HTTP en `net._http_response` y logs de la función;
estos últimos solo incluyen el ID de evento. Un 204 significa aceptación por el
proveedor, no entrega confirmada en la bandeja. Para entrega recuperable después de
caídas se necesitaría una outbox persistente y un worker de reintentos.

Reversión del listener (no cambia citas):

```sql
DROP TRIGGER IF EXISTS appointment_on_hold_email ON public.appointments;
DROP FUNCTION IF EXISTS public.notify_appointment_on_hold();
```

No se desplegó ni se enviaron correos reales desde este trabajo.

Referencias: https://supabase.com/docs/guides/database/extensions/pg_net,
https://supabase.com/docs/guides/database/webhooks,
https://resend.com/docs/dashboard/emails/idempotency-keys.
