CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
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
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY "Anyone can read active doctors" ON public.doctors;
DROP POLICY "Admins can create doctors" ON public.doctors;
DROP POLICY "Admins can update doctors" ON public.doctors;
DROP POLICY "Admins can delete doctors" ON public.doctors;

CREATE POLICY "Anyone can read active doctors" ON public.doctors
  FOR SELECT TO anon, authenticated USING (is_active = true OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create doctors" ON public.doctors
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update doctors" ON public.doctors
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete doctors" ON public.doctors
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.has_role(uuid, public.app_role);