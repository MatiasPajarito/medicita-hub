CREATE TABLE public.doctor_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  break_start time,
  break_end time,
  slot_duration_minutes integer NOT NULL DEFAULT 30 CHECK (slot_duration_minutes BETWEEN 5 AND 240),
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, day_of_week),
  CHECK (end_time > start_time),
  CHECK ((break_start IS NULL AND break_end IS NULL) OR (break_start IS NOT NULL AND break_end IS NOT NULL AND break_end > break_start AND break_start >= start_time AND break_end <= end_time))
);
GRANT SELECT ON public.doctor_schedules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_schedules TO authenticated;
GRANT ALL ON public.doctor_schedules TO service_role;
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read schedules of active doctors" ON public.doctor_schedules
FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.is_active));

CREATE POLICY "Doctors read own schedules" ON public.doctor_schedules
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Doctors insert own schedules" ON public.doctor_schedules
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Doctors update own schedules" ON public.doctor_schedules
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Doctors delete own schedules" ON public.doctor_schedules
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Doctors read own doctor profile" ON public.doctors
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER doctor_schedules_set_updated_at BEFORE UPDATE ON public.doctor_schedules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();