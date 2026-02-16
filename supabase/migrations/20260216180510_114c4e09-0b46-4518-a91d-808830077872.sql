
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'unit_head', 'individual');
CREATE TYPE public.duty_system AS ENUM ('daily', 'shift_77', 'shift_1515');
CREATE TYPE public.unit_type AS ENUM ('preparation', 'curriculum');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  unit unit_type,
  duty_system duty_system NOT NULL DEFAULT 'daily',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  unit unit_type,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function: get user's unit
CREATE OR REPLACE FUNCTION public.get_user_unit(_user_id UUID)
RETURNS unit_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Helper function: check if user is unit head of a specific unit
CREATE OR REPLACE FUNCTION public.is_unit_head_of(_user_id UUID, _unit unit_type)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'unit_head' AND unit = _unit
  )
$$;

-- Helper function: get profile unit by profile user_id
CREATE OR REPLACE FUNCTION public.get_profile_unit(_profile_user_id UUID)
RETURNS unit_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit FROM public.profiles WHERE user_id = _profile_user_id LIMIT 1
$$;

-- ==================== RLS POLICIES ====================

-- PROFILES policies
CREATE POLICY "Admin can do everything on profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Unit heads can view their unit profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'unit_head')
    AND public.is_unit_head_of(auth.uid(), unit)
  );

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- USER_ROLES policies
CREATE POLICY "Admin can do everything on user_roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- AUDIT_LOG policies
CREATE POLICY "Admin can view all audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Unit heads can view their unit audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'unit_head')
    AND (
      user_id = auth.uid()
      OR public.is_unit_head_of(auth.uid(), public.get_profile_unit(user_id))
    )
  );

CREATE POLICY "Users can view own audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at on profiles
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
