import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useNotifications() {
  const { user, role } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");
  
  // حفظ وقت آخر فحص لمعرفة المهام الجديدة فقط
  const lastCheckRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        permissionRef.current = "granted";
      } else if (Notification.permission !== "denied") {
        permissionRef.current = Notification.permission;
      }
    }
  }, []);

  const showNativeNotification = async (title: string, body: string, data: any = {}) => {
    if (permissionRef.current === "granted" && "Notification" in window) {
      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            dir: "rtl",
            tag: `notif-${Date.now()}`,
            vibrate: [200, 100, 200],
            data: { ...data, url: "/" }
          });
        } else {
          new Notification(title, { body, icon: "/favicon.ico", dir: "rtl" });
        }
      } catch (error) {
        console.error("فشل إرسال الإشعار عبر SW، استخدام الخطة البديلة:", error);
        new Notification(title, { body, icon: "/favicon.ico", dir: "rtl" });
      }
    }
  };

  useEffect(() => {
    if (!user) return;

    // دالة الفحص الدوري للمهام والتعليقات الجديدة
    const checkForUpdates = async () => {
      const now = new Date().toISOString();
      const lastCheck = lastCheckRef.current;

      try {
        // 1. البحث عن مهام جديدة تم تكليفي بها منذ آخر فحص
        const { data: newTasks } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("assigned_to", user.id)
          .gt("created_at", lastCheck);

        if (newTasks && newTasks.length > 0) {
          newTasks.forEach(task => {
            toast.info("📋 مهمة جديدة", { description: task.title });
            showNativeNotification("مهمة جديدة وردت إليك", task.title, { taskId: task.id, type: 'new_task' });
          });
        }

        // 2. البحث عن تعليقات جديدة على المهام التي أشارك فيها
        const { data: newComments } = await supabase
          .from("task_comments")
          .select("id, task_id, message, user_id, tasks(title, assigned_to, assigned_by)")
          .neq("user_id", user.id)
          .gt("created_at", lastCheck);

        if (newComments && newComments.length > 0) {
          newComments.forEach(comment => {
            // @ts-ignore - Supabase join typing
            const task = comment.tasks;
            if (task && (task.assigned_to === user.id || task.assigned_by === user.id)) {
              toast.info("💬 تعليق جديد", { description: `على مهمة: ${task.title}` });
              showNativeNotification("تعليق جديد على مهمة", task.title, { taskId: comment.task_id, type: 'new_comment' });
            }
          });
        }

        // 3. للمدراء: البحث عن طلبات إجازة جديدة
        if (role === "admin" || role === "unit_head") {
          const { data: newLeaves } = await supabase
            .from("leave_requests")
            .select("id, leave_type, user_id")
            .neq("user_id", user.id)
            .gt("created_at", lastCheck);

          if (newLeaves && newLeaves.length > 0) {
            newLeaves.forEach(req => {
              const type = req.leave_type === "leave" ? "إجازة" : "زمنية";
              toast.info(`📝 طلب ${type} جديد`, { description: "يحتاج مراجعتك" });
              showNativeNotification(`طلب ${type} جديد`, "يوجد طلب جديد يحتاج إلى مراجعتك", { requestId: req.id, type: 'new_leave' });
            });
          }
        }

        // تحديث "وقت آخر فحص" ليكون الوقت الحالي لكي لا تتكرر الإشعارات
        lastCheckRef.current = now;

      } catch (error) {
        console.error("Error during polling for updates:", error);
      }
    };

    // تشغيل الفحص كل 10 ثوانٍ (10000 ميلي ثانية)
    // يمكنك تقليل الرقم إلى 5000 إذا كنت تريد فحصاً أسرع (كل 5 ثواني)
    const intervalId = setInterval(checkForUpdates, 10000);

    // تنظيف المؤقت عند إغلاق التطبيق
    return () => {
      clearInterval(intervalId);
    };
  }, [user, role]);
}
