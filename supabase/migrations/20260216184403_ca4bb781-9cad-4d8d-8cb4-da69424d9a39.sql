
-- Fix: All RLS policies are RESTRICTIVE (they AND together = nobody can access).
-- We need PERMISSIVE policies (they OR together = any matching policy grants access).

-- ==================== PROFILES ====================
DROP POLICY IF EXISTS "Admin can do everything on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Unit heads can view their unit profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Admin full access profiles" ON public.profiles FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Unit heads view unit profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), unit));
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== USER_ROLES ====================
DROP POLICY IF EXISTS "Admin can do everything on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admin full access user_roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- ==================== ATTENDANCE ====================
DROP POLICY IF EXISTS "Admin full access attendance" ON public.attendance;
DROP POLICY IF EXISTS "Unit heads insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Unit heads view their unit attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users view own attendance" ON public.attendance;

CREATE POLICY "Admin full access attendance" ON public.attendance FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Unit heads insert attendance" ON public.attendance FOR INSERT WITH CHECK (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), get_profile_unit(user_id)));
CREATE POLICY "Unit heads view unit attendance" ON public.attendance FOR SELECT USING (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), get_profile_unit(user_id)));
CREATE POLICY "Users view own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id);

-- ==================== AUDIT_LOG ====================
DROP POLICY IF EXISTS "Admin can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Unit heads can view their unit audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;

CREATE POLICY "Admin view all audit logs" ON public.audit_log FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own audit logs" ON public.audit_log FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Unit heads view unit audit logs" ON public.audit_log FOR SELECT USING (has_role(auth.uid(), 'unit_head') AND (user_id = auth.uid() OR is_unit_head_of(auth.uid(), get_profile_unit(user_id))));
CREATE POLICY "Users view own audit logs" ON public.audit_log FOR SELECT USING (user_id = auth.uid());

-- ==================== CURRICULA ====================
DROP POLICY IF EXISTS "Admin full access curricula" ON public.curricula;
DROP POLICY IF EXISTS "Individuals insert curricula" ON public.curricula;
DROP POLICY IF EXISTS "Individuals update own curricula" ON public.curricula;
DROP POLICY IF EXISTS "Individuals view their unit curricula" ON public.curricula;
DROP POLICY IF EXISTS "Unit heads manage their unit curricula" ON public.curricula;
DROP POLICY IF EXISTS "Unit heads update their unit curricula" ON public.curricula;
DROP POLICY IF EXISTS "Unit heads view their unit curricula" ON public.curricula;

CREATE POLICY "Admin full access curricula" ON public.curricula FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Unit heads manage curricula" ON public.curricula FOR ALL USING (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), unit)) WITH CHECK (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), unit));
CREATE POLICY "Individuals view unit curricula" ON public.curricula FOR SELECT USING (has_role(auth.uid(), 'individual') AND unit = get_user_unit(auth.uid()));
CREATE POLICY "Individuals insert curricula" ON public.curricula FOR INSERT WITH CHECK (has_role(auth.uid(), 'individual') AND unit = get_user_unit(auth.uid()));
CREATE POLICY "Individuals update own curricula" ON public.curricula FOR UPDATE USING (has_role(auth.uid(), 'individual') AND created_by = auth.uid()) WITH CHECK (has_role(auth.uid(), 'individual') AND created_by = auth.uid());

-- ==================== LEAVE_REQUESTS ====================
DROP POLICY IF EXISTS "Admin full access leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Unit heads update their unit leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Unit heads view their unit leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users insert own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users update own pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users view own leave requests" ON public.leave_requests;

CREATE POLICY "Admin full access leave_requests" ON public.leave_requests FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Unit heads update unit leave requests" ON public.leave_requests FOR UPDATE USING (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), get_profile_unit(user_id))) WITH CHECK (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), get_profile_unit(user_id)));
CREATE POLICY "Unit heads view unit leave requests" ON public.leave_requests FOR SELECT USING (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), get_profile_unit(user_id)));
CREATE POLICY "Users insert own leave requests" ON public.leave_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pending requests" ON public.leave_requests FOR UPDATE USING (auth.uid() = user_id AND status = 'pending') WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Users view own leave requests" ON public.leave_requests FOR SELECT USING (auth.uid() = user_id);

-- ==================== LEAVE_BALANCES ====================
DROP POLICY IF EXISTS "Admin full access leave_balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Unit heads view their unit balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Users view own balances" ON public.leave_balances;

CREATE POLICY "Admin full access leave_balances" ON public.leave_balances FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Unit heads view unit balances" ON public.leave_balances FOR SELECT USING (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), get_profile_unit(user_id)));
CREATE POLICY "Users view own balances" ON public.leave_balances FOR SELECT USING (auth.uid() = user_id);

-- ==================== TASKS ====================
DROP POLICY IF EXISTS "Admin full access tasks" ON public.tasks;
DROP POLICY IF EXISTS "Unit heads manage their unit tasks" ON public.tasks;
DROP POLICY IF EXISTS "Unit heads view their unit tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users update assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users view assigned tasks" ON public.tasks;

CREATE POLICY "Admin full access tasks" ON public.tasks FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Unit heads manage unit tasks" ON public.tasks FOR ALL USING (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), unit)) WITH CHECK (has_role(auth.uid(), 'unit_head') AND is_unit_head_of(auth.uid(), unit));
CREATE POLICY "Users view assigned tasks" ON public.tasks FOR SELECT USING (assigned_to = auth.uid());
CREATE POLICY "Users update assigned tasks" ON public.tasks FOR UPDATE USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());

-- ==================== CREATE TRIGGER ====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add unique constraint on profiles.user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;
