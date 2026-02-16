
-- Allow individuals to update any curriculum in their unit (not just ones they created)
DROP POLICY IF EXISTS "Individuals update own curricula" ON public.curricula;
CREATE POLICY "Individuals update unit curricula"
ON public.curricula FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'individual'::app_role) AND unit = get_user_unit(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'individual'::app_role) AND unit = get_user_unit(auth.uid()));
