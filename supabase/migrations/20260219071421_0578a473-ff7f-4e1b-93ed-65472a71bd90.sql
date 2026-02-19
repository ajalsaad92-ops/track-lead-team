
-- Allow unit heads to view all profiles (needed for task assignment)
-- The existing policy only allows viewing their unit's profiles
-- We need to allow admins and unit heads to see all profiles for task assignment

-- Add a policy that allows unit heads to see profiles they need for assigning tasks
CREATE POLICY "Unit heads view all profiles for task assignment"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'unit_head'::app_role)
  );
