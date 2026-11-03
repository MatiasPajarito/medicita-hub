-- Pending: database connection unavailable; this SQL has NOT been applied.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS rut_dni text,
  ADD COLUMN IF NOT EXISTS medical_registration text,
  ADD COLUMN IF NOT EXISTS modalities text[] NOT NULL DEFAULT ARRAY['presencial','telemedicina']::text[];

-- Existing table-level UPDATE grants are retained for admin workflows.
-- Column privileges prevent linked doctors from editing ownership/activation/fees.
REVOKE UPDATE ON public.doctors FROM authenticated;
GRANT UPDATE (full_name, rut_dni, specialty, medical_registration, modalities, bio, photo_url, consultation_fee, is_active, updated_at) ON public.doctors TO authenticated;
CREATE POLICY "Doctors update own professional profile" ON public.doctors
  FOR UPDATE TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE FUNCTION public.protect_doctor_management_fields() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(),'admin') AND
    (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.consultation_fee IS DISTINCT FROM OLD.consultation_fee OR NEW.photo_url IS DISTINCT FROM OLD.photo_url) THEN
    RAISE EXCEPTION 'Se requiere un administrador para cambiar estos datos';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_doctor_management_fields BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.protect_doctor_management_fields();

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id),
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  modality text NOT NULL CHECK (modality IN ('presencial','telemedicina')),
  status text NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada','completada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time>start_time),
  EXCLUDE USING gist (doctor_id WITH =, tsrange(appointment_date+start_time,appointment_date+end_time,'[)') WITH &&)
    WHERE (status='confirmada')
);
GRANT SELECT, INSERT ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read appointments" ON public.appointments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id=patient_id AND p.user_id=auth.uid())
    OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id=doctor_id AND d.user_id=auth.uid()));
CREATE POLICY "Patients book own appointments" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (status='confirmada' AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id=patient_id AND p.user_id=auth.uid()));

CREATE FUNCTION public.validate_clinical_booking() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.doctor_schedules;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.patients WHERE id=NEW.patient_id AND user_id=auth.uid()) OR NEW.status<>'confirmada' THEN
    RAISE EXCEPTION 'Debes iniciar sesión con tu cuenta de paciente';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.doctors WHERE id=NEW.doctor_id AND is_active AND NEW.modality=ANY(modalities)) THEN
    RAISE EXCEPTION 'Profesional o modalidad no disponible';
  END IF;
  SELECT * INTO s FROM public.doctor_schedules
    WHERE doctor_id=NEW.doctor_id AND day_of_week=extract(isodow FROM NEW.appointment_date)::int-1 AND is_available FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El profesional no atiende en esa fecha'; END IF;
  IF NEW.appointment_date+NEW.start_time <= timezone('America/Santiago',now())
    OR NEW.start_time<s.start_time OR NEW.end_time>s.end_time
    OR NEW.end_time<>NEW.start_time+make_interval(mins=>s.slot_duration_minutes)
    OR mod(extract(epoch FROM (NEW.start_time-s.start_time))::int,s.slot_duration_minutes*60)<>0
    OR (s.break_start IS NOT NULL AND NEW.start_time<s.break_end AND NEW.end_time>s.break_start) THEN
    RAISE EXCEPTION 'El bloque seleccionado no está disponible';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_booking BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_clinical_booking();

CREATE FUNCTION public.booked_clinical_slots(_doctor_id uuid,_from date,_to date)
  RETURNS TABLE(appointment_date date,start_time time,end_time time)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
    SELECT a.appointment_date,a.start_time,a.end_time FROM public.appointments a
    JOIN public.doctors d ON d.id=a.doctor_id
    WHERE d.is_active AND a.doctor_id=_doctor_id AND a.status='confirmada'
      AND a.appointment_date BETWEEN _from AND _to AND _to-_from BETWEEN 0 AND 90
  $$;
REVOKE ALL ON FUNCTION public.booked_clinical_slots(uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booked_clinical_slots(uuid,date,date) TO anon,authenticated;