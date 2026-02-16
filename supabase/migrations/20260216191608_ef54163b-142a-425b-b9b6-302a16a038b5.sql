-- Enable realtime for dashboard-relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.curricula;