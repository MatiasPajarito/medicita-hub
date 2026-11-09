-- Ejecutar después de habilitar el flujo On Hold y configurar Vault (ver README).
-- No altera estados, permisos, reservas ni validadores existentes.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_appointment_on_hold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  endpoint text;
  webhook_secret text;
BEGIN
  SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets
    WHERE name = 'on_hold_webhook_url';
  SELECT decrypted_secret INTO webhook_secret FROM vault.decrypted_secrets
    WHERE name = 'on_hold_webhook_secret';
  IF endpoint IS NULL OR webhook_secret IS NULL THEN
    RAISE WARNING 'on_hold_notification_not_configured';
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-on-hold-secret', webhook_secret),
    body := jsonb_build_object(
      'event_id', gen_random_uuid()::text,
      'type', 'UPDATE', 'schema', 'public', 'table', 'appointments',
      'old_record', jsonb_build_object('status', OLD.status),
      'record', jsonb_build_object(
        'id', NEW.id, 'patient_id', NEW.patient_id, 'status', NEW.status,
        'appointment_date', NEW.appointment_date, 'start_time', NEW.start_time,
        'on_hold_reason', to_jsonb(NEW)->>'on_hold_reason'
      )
    ),
    timeout_milliseconds := 20000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Incluso un fallo al encolar el HTTP permite confirmar la cita.
  RAISE WARNING 'on_hold_notification_enqueue_failed';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_appointment_on_hold() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER appointment_on_hold_email
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
WHEN (
  replace(replace(lower(trim(NEW.status)), ' ', '_'), '-', '_') = 'on_hold'
  AND replace(replace(lower(trim(OLD.status)), ' ', '_'), '-', '_') IS DISTINCT FROM 'on_hold'
)
EXECUTE FUNCTION public.notify_appointment_on_hold();
COMMIT;
