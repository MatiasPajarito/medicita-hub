DROP POLICY "Anyone can read active doctors" ON public.doctors;
CREATE POLICY "Anyone can read active doctors" ON public.doctors
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins can read all doctors" ON public.doctors
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));