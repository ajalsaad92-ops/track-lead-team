import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Requests browser notification permission and subscribes to
 * realtime changes on tasks, task_comments, and leave_requests.
 * Shows both in-app toasts and native browser notifications via Service Worker.
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
        // We only check current status, asking for permission is now in Profile page
        permissionRef.current = Notification.permission;
      }
    }
  }, []);

  // دالة متطورة لإظهار الإشعارات عبر Service Worker لضمان وصولها
  const showNativeNotification = async (title: string, body: string, data: any = {}) => {
    // 1. إظهار الإشعار المرئي للمستخدم
    if (permissionRef.current === "granted" && "serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          dir: "rtl",
          tag: `notif-${Date.now()}`,
          vibrate: [200, 100, 200], // اهتزاز للجوال
          data: { ...data, url: "/" } // البيانات الإضافية للتتبع
        });
      } catch (error) {
        console.error("Failed to show notification via Service Worker:", error);
      }
    }

    // 2. [مستقبلاً] أرشفة الإشعار في قاعدة البيانات للتتبع (من قرأه ومن لم يقرأه)
    if (user) {
      /* * ملاحظة: يجب إنشاء جدول 'user_notifications' في Supabase لاحقاً 
       * يحتوي على الأعمدة: id, user_id, title, body, is_read, created_at
       */
      try {
        await supabase.from("user_notifications").insert({
          user_id: user.id,
          title: title,
          body: body,
          is_read: false,
          reference_data: data // لحفظ رقم المهمة أو الطلب للرجوع إليه
        });
      } catch (err) {
        // تجاهل الخطأ مؤقتاً حتى يتم إنشاء الجدول مستقبلاً
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
          const task = payload.new as { id: string; title: string };
          toast.info("📋 مهمة جديدة", { description: task.title });
          showNativeNotification("مهمة جديدة وردت إليك", task.title, { taskId: task.id, type: 'new_task' });
        }
      )
      // Task status changed on my tasks
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `assigned_to=eq.${user.id}` },
        (payload) => {
          const task = payload.new as { id: string; title: string; status: string };
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
            showNativeNotification("تحديث حالة مهمة", `${task.title} → ${label}`, { taskId: task.id, type: 'status_update' });
          }
        }
      )
      // New comment on tasks I'm involved in
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_comments" },
        async (payload) => {
          const comment = payload.new as { id: string; task_id: string; user_id: string; message: string };
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
            showNativeNotification("تعليق جديد على مهمة", task.title, { taskId: comment.task_id, commentId: comment.id, type: 'new_comment' });
          }
        }
      )
      // Leave request updates (for individuals)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leave_requests", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const req = payload.new as { id: string; status: string; leave_type: string };
          const old = payload.old as { status: string };
          if (req.status !== old.status) {
            const type = req.leave_type === "leave" ? "إجازة" : "زمنية";
            toast.info(`تحديث طلب ${type}`, { description: `الحالة: ${req.status}` });
            showNativeNotification(`تحديث طلب ${type}`, `تم تغيير حالة الطلب إلى ${req.status}`, { requestId: req.id, type: 'leave_update' });
          }
        }
      );

    // For admins/unit_heads: notify on new leave requests
    if (role === "admin" || role === "unit_head") {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leave_requests" },
        (payload) => {
          const req = payload.new as { id: string; leave_type: string; user_id: string };
          if (req.user_id === user.id) return;
          const type = req.leave_type === "leave" ? "إجازة" : "زمنية";
          toast.info(`📝 طلب ${type} جديد`, { description: "يحتاج مراجعتك" });
          showNativeNotification(`طلب ${type} جديد`, "يوجد طلب جديد يحتاج إلى مراجعتك", { requestId: req.id, type: 'new_leave' });
        }
      );

      // Notify admins/unit_heads when tasks are completed
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks" },
        (payload) => {
          const task = payload.new as { id: string; title: string; status: string; assigned_by: string };
          const old = payload.old as { status: string };
          if (task.status !== old.status && task.status === "completed" && task.assigned_by === user.id) {
            toast.info("✅ مهمة مكتملة", { description: task.title });
            showNativeNotification("مهمة مكتملة تحتاج مراجعة", task.title, { taskId: task.id, type: 'task_completed' });
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
