import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Requests browser notification permission and subscribes to
 * realtime changes on tasks, task_comments, and leave_requests.
 * Shows both in-app toasts and native browser notifications.
 */
export function useNotifications() {
  const { user, role } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");

  // Request permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        permissionRef.current = "granted";
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((p) => {
          permissionRef.current = p;
        });
      }
    }
  }, []);

  const showNativeNotification = (title: string, body: string) => {
    if (permissionRef.current === "granted" && "Notification" in window) {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: `notif-${Date.now()}`,
        });
      } catch {
        // Silent fail for environments that don't support Notification constructor
      }
    }
  };

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-notifications")
      // New task assigned to me
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks", filter: `assigned_to=eq.${user.id}` },
        (payload) => {
          const task = payload.new as { title: string };
          toast.info("📋 مهمة جديدة", { description: task.title });
          showNativeNotification("مهمة جديدة وردت إليك", task.title);
        }
      )
      // Task status changed on my tasks
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `assigned_to=eq.${user.id}` },
        (payload) => {
          const task = payload.new as { title: string; status: string };
          const old = payload.old as { status: string };
          if (task.status !== old.status) {
            const statusLabels: Record<string, string> = {
              in_progress: "قيد التنفيذ",
              completed: "مكتملة",
              under_review: "تحت المراجعة",
              approved: "معتمدة",
              assigned: "مكلّف",
              suspended: "معلّقة",
            };
            const label = statusLabels[task.status] ?? task.status;
            toast.info(`تحديث مهمة: ${label}`, { description: task.title });
            showNativeNotification("تحديث حالة مهمة", `${task.title} → ${label}`);
          }
        }
      )
      // New comment on tasks I'm involved in
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_comments" },
        async (payload) => {
          const comment = payload.new as { task_id: string; user_id: string; message: string };
          // Don't notify for own comments
          if (comment.user_id === user.id) return;
          // Check if I'm involved in this task
          const { data: task } = await supabase
            .from("tasks")
            .select("title, assigned_to, assigned_by")
            .eq("id", comment.task_id)
            .maybeSingle();
          if (task && (task.assigned_to === user.id || task.assigned_by === user.id)) {
            toast.info("💬 تعليق جديد", { description: `على مهمة: ${task.title}` });
            showNativeNotification("تعليق جديد على مهمة", task.title);
          }
        }
      )
      // Leave request updates (for individuals)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leave_requests", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const req = payload.new as { status: string; leave_type: string };
          const old = payload.old as { status: string };
          if (req.status !== old.status) {
            const type = req.leave_type === "leave" ? "إجازة" : "زمنية";
            toast.info(`تحديث طلب ${type}`, { description: `الحالة: ${req.status}` });
            showNativeNotification(`تحديث طلب ${type}`, `تم تغيير حالة الطلب`);
          }
        }
      );

    // For admins/unit_heads: notify on new leave requests
    if (role === "admin" || role === "unit_head") {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leave_requests" },
        (payload) => {
          const req = payload.new as { leave_type: string; user_id: string };
          if (req.user_id === user.id) return;
          const type = req.leave_type === "leave" ? "إجازة" : "زمنية";
          toast.info(`📝 طلب ${type} جديد`, { description: "يحتاج مراجعتك" });
          showNativeNotification(`طلب ${type} جديد`, "يحتاج مراجعتك");
        }
      );

      // Notify admins/unit_heads when tasks are completed
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks" },
        (payload) => {
          const task = payload.new as { title: string; status: string; assigned_by: string };
          const old = payload.old as { status: string };
          if (task.status !== old.status && task.status === "completed" && task.assigned_by === user.id) {
            toast.info("✅ مهمة مكتملة", { description: task.title });
            showNativeNotification("مهمة مكتملة تحتاج مراجعة", task.title);
          }
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);
}
