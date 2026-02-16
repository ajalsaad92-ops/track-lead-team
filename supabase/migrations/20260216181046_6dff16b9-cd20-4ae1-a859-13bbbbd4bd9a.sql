
-- Enums for leave/task status
CREATE TYPE public.attendance_status AS ENUM ('present', 'leave', 'time_off', 'duty', 'absent');
CREATE TYPE public.leave_type AS ENUM ('leave', 'time_off');
CREATE TYPE public.approval_status AS ENUM ('pending', 'unit_head_approved', 'unit_head_rejected', 'admin_approved', 'admin_rejected');
CREATE TYPE public.task_type AS ENUM ('curriculum_task', 'regular_task');
CREATE TYPE public.task_status AS ENUM ('assigned', 'in_progress', 'completed', 'under_review', 'approved', 'suspended');
CREATE TYPE public.audit_status AS ENUM ('done', 'in_progress', 'not_started');
CREATE TYPE public.curriculum_stage AS ENUM ('printed', 'form', 'powerpoint', 'application', 'objectives', 'audit', 'completed');

-- ===================== ATTENDANCE =====================
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Unit heads view their unit attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), public.get_profile_unit(user_id)));

CREATE POLICY "Unit heads insert attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), public.get_profile_unit(user_id)));

CREATE POLICY "Users view own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ===================== LEAVE REQUESTS =====================
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  leave_type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  hours NUMERIC(4,1),
  reason TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  unit_head_decision approval_status,
  unit_head_id UUID REFERENCES auth.users(id),
  unit_head_date TIMESTAMPTZ,
  unit_head_notes TEXT,
  admin_decision approval_status,
  admin_id UUID REFERENCES auth.users(id),
  admin_date TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access leave_requests" ON public.leave_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Unit heads view their unit leave requests" ON public.leave_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), public.get_profile_unit(user_id)));

CREATE POLICY "Unit heads update their unit leave requests" ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), public.get_profile_unit(user_id)))
  WITH CHECK (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), public.get_profile_unit(user_id)));

CREATE POLICY "Users view own leave requests" ON public.leave_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own leave requests" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pending leave requests" ON public.leave_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== CURRICULA =====================
CREATE TABLE public.curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  is_printed BOOLEAN NOT NULL DEFAULT false,
  form_type TEXT NOT NULL DEFAULT 'new',
  powerpoint_status TEXT NOT NULL DEFAULT 'new',
  target_groups TEXT,
  is_applied BOOLEAN NOT NULL DEFAULT false,
  objectives TEXT,
  executing_entity TEXT,
  hours NUMERIC(5,1),
  prepared_by TEXT,
  location TEXT,
  trainer TEXT,
  audit_status audit_status NOT NULL DEFAULT 'not_started',
  stage curriculum_stage NOT NULL DEFAULT 'printed',
  file_urls JSONB DEFAULT '[]'::jsonb,
  unit unit_type NOT NULL DEFAULT 'curriculum',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.curricula ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access curricula" ON public.curricula FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Unit heads view their unit curricula" ON public.curricula FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), unit));

CREATE POLICY "Unit heads manage their unit curricula" ON public.curricula FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), unit));

CREATE POLICY "Unit heads update their unit curricula" ON public.curricula FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), unit))
  WITH CHECK (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), unit));

CREATE POLICY "Individuals view their unit curricula" ON public.curricula FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'individual') AND unit = public.get_user_unit(auth.uid()));

CREATE POLICY "Individuals insert curricula" ON public.curricula FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'individual') AND unit = public.get_user_unit(auth.uid()));

CREATE POLICY "Individuals update own curricula" ON public.curricula FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'individual') AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'individual') AND created_by = auth.uid());

CREATE TRIGGER update_curricula_updated_at BEFORE UPDATE ON public.curricula
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== TASKS =====================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  task_type task_type NOT NULL DEFAULT 'regular_task',
  status task_status NOT NULL DEFAULT 'assigned',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unit unit_type,
  due_date TIMESTAMPTZ,
  estimated_hours NUMERIC(5,1),
  curriculum_id UUID REFERENCES public.curricula(id) ON DELETE SET NULL,
  completion_notes TEXT,
  review_notes TEXT,
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access tasks" ON public.tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Unit heads view their unit tasks" ON public.tasks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), unit));

CREATE POLICY "Unit heads manage their unit tasks" ON public.tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), unit))
  WITH CHECK (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), unit));

CREATE POLICY "Users view assigned tasks" ON public.tasks FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "Users update assigned tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== LEAVE BALANCES (auto monthly) =====================
CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month DATE NOT NULL,
  leave_days_total NUMERIC(3,1) NOT NULL DEFAULT 3,
  leave_days_used NUMERIC(3,1) NOT NULL DEFAULT 0,
  time_off_hours_total NUMERIC(4,1) NOT NULL DEFAULT 7,
  time_off_hours_used NUMERIC(4,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access leave_balances" ON public.leave_balances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Unit heads view their unit balances" ON public.leave_balances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'unit_head') AND public.is_unit_head_of(auth.uid(), public.get_profile_unit(user_id)));

CREATE POLICY "Users view own balances" ON public.leave_balances FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ===================== STORAGE BUCKET =====================
INSERT INTO storage.buckets (id, name, public) VALUES ('curriculum-files', 'curriculum-files', false);

CREATE POLICY "Auth users can upload curriculum files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'curriculum-files');

CREATE POLICY "Auth users can view curriculum files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'curriculum-files');
