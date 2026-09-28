CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'patient');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  rut_dni text NOT NULL UNIQUE CHECK (rut_dni ~ '^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9K]$'),
  email text NOT NULL CHECK (char_length(email) <= 255),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 30),
  birth_date date NOT NULL CHECK (birth_date <= CURRENT_DATE),
  blood_type text CHECK (blood_type IS NULL OR blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  emergency_contact_name text CHECK (emergency_contact_name IS NULL OR char_length(emergency_contact_name) <= 120),
  emergency_contact_phone text CHECK (emergency_contact_phone IS NULL OR char_length(emergency_contact_phone) <= 30),
  allergies text NOT NULL DEFAULT '' CHECK (char_length(allergies) <= 2000),
  chronic_conditions text NOT NULL DEFAULT '' CHECK (char_length(chronic_conditions) <= 2000),
  medical_history_notes text NOT NULL DEFAULT '' CHECK (char_length(medical_history_notes) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients can read own profile" ON public.patients
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Patients can create own profile" ON public.patients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Patients can update own profile" ON public.patients
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Patients can delete own profile" ON public.patients
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  specialty text NOT NULL CHECK (char_length(specialty) BETWEEN 2 AND 100),
  bio text NOT NULL CHECK (char_length(bio) BETWEEN 10 AND 1000),
  photo_url text CHECK (photo_url IS NULL OR char_length(photo_url) <= 1000),
  consultation_fee integer NOT NULL CHECK (consultation_fee >= 0 AND consultation_fee <= 10000000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.doctors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active doctors" ON public.doctors
  FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create doctors" ON public.doctors
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update doctors" ON public.doctors
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete doctors" ON public.doctors
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER patients_set_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER doctors_set_updated_at
BEFORE UPDATE ON public.doctors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX patients_full_name_idx ON public.patients (full_name);
CREATE INDEX doctors_active_specialty_idx ON public.doctors (is_active, specialty);