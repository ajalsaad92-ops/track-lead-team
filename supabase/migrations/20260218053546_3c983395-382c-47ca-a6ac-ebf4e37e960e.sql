
-- Create task_comments table for task communication
CREATE TABLE public.task_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Only admin, unit_head who assigned, and the assigned user can see/add comments
-- Use a function to check access
CREATE OR REPLACE FUNCTION public.can_access_task_comment(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = _task_id
    AND (
      t.assigned_to = _user_id
      OR t.assigned_by = _user_id
      OR has_role(_user_id, 'admin')
    )
  )
$$;

CREATE POLICY "Task comment access"
  ON public.task_comments FOR SELECT
  USING (can_access_task_comment(task_id, auth.uid()));

CREATE POLICY "Task comment insert"
  ON public.task_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND can_access_task_comment(task_id, auth.uid())
  );

-- Enable realtime for task_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

-- Also enable realtime for tasks table (for new task notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
