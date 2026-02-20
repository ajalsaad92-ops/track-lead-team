import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useNotifications() {
  const { user, role } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");
  
  // حفظ وقت آخر فحص لمعرفة التغييرات الجديدة فقط
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

    // دالة الفحص الدوري الشاملة (للمهام، الإجراءات، الإجازات، والتعليقات)
    const checkForUpdates = async () => {
      const now = new Date().toISOString();
      const lastCheck = lastCheckRef.current;

      try {
        // ==========================================
        // 1. مراقبة المهام (المهام الجديدة + تحديثات الإجراءات)
        // ==========================================
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, status, created_at, updated_at, assigned_to, assigned_by")
          .gt("updated_at", lastCheck);

        if (tasks && tasks.length > 0) {
          tasks.forEach(task => {
            const isNew = task.created_at > lastCheck;
            
            // الحالة أ: تم تكليفي بمهمة جديدة
            if (isNew && task.assigned_to === user.id) {
              toast.info("📋 مهمة جديدة", { description: task.title });
              showNativeNotification("مهمة جديدة وردت إليك", task.title, { taskId: task.id, type: 'new_task' });
            } 
            // الحالة ب: تم اتخاذ إجراء أو تحديث حالة مهمة تخصني (أنا منفذها أو منشئها)
            else if (!isNew && (task.assigned_to === user.id || task.assigned_by === user.id)) {
              // ترجمة حالة المهمة للعربية لتكون أوضح في الإشعار
              const statusLabels: Record<string, string> = {
                in_progress: "قيد التنفيذ ⏳",
                completed: "مكتملة ✅",
                under_review: "تحت المراجعة 🔎",
                approved: "معتمدة 🌟",
                assigned: "مكلّف 📌",
                suspended: "معلّقة ⏸️",
              };
              const statusAr = statusLabels[task.status] || task.status;
              
              toast.info("🔄 تحديث إجراءات المهمة", { description: `${task.title} - أصبحت: ${statusAr}` });
              showNativeNotification("تحديث في حالة المهمة", `${task.title} \nالحالة الجديدة: ${statusAr}`, { taskId: task.id, type: 'update_task' });
            }
          });
        }

        // ==========================================
        // 2. مراقبة الإجازات (طلبات جديدة + تحديثات القبول/الرفض)
        // ==========================================
        const { data: leaves } = await supabase
          .from("leave_requests")
          .select("id, leave_type, status, created_at, updated_at, user_id")
          .gt("updated_at", lastCheck);

        if (leaves && leaves.length > 0) {
          leaves.forEach(req => {
            const isNew = req.created_at > lastCheck;
            const typeName = req.leave_type === "leave" ? "إجازة يومية" : "إجازة زمنية";

            // الحالة أ: أنا مدير، وهناك موظف قدم طلب إجازة جديد
            if (isNew && req.user_id !== user.id && (role === "admin" || role === "unit_head")) {
              toast.info(`📝 طلب ${typeName} جديد`, { description: "يحتاج إلى مراجعتك واعتمادك" });
              showNativeNotification(`طلب ${typeName} جديد`, "يوجد طلب يحتاج إلى اتخاذ إجراء", { requestId: req.id, type: 'new_leave' });
            }
            // الحالة ب: أنا موظف، والمدير قام بالموافقة أو الرفض لطلبي
            else if (!isNew && req.user_id === user.id) {
              const statusAr = req.status === "approved" ? "موافق عليه ✅" : req.status === "rejected" ? "مرفوض ❌" : "قيد المراجعة";
              toast.success(`تحديث في طلب الـ ${typeName}`, { description: `حالة طلبك الآن: ${statusAr}` });
              showNativeNotification(`تحديث طلب الإجازة`, `تم تغيير حالة طلبك إلى: ${statusAr}`, { requestId: req.id, type: 'update_leave' });
            }
          });
        }

        // ==========================================
        // 3. مراقبة التعليقات (فقط التعليقات الجديدة)
        // ==========================================
        const { data: comments } = await supabase
          .from("task_comments")
          .select("id, task_id, message, created_at, user_id, tasks(title, assigned_to, assigned_by)")
          .gt("created_at", lastCheck)
          .neq("user_id", user.id); // لا ترسل لي إشعار بتعليقي الذي كتبته للتو!

        if (comments && comments.length > 0) {
          comments.forEach(comment => {
            // @ts-ignore
            const task = comment.tasks;
            // التحقق من أن التعليق يخص مهمة أنا مشارك فيها
            if (task && (task.assigned_to === user.id || task.assigned_by === user.id)) {
              toast.info("💬 تعليق جديد", { description: `على مهمة: ${task.title}` });
              showNativeNotification("تعليق جديد", `تم إضافة تعليق على مهمة: ${task.title}`, { taskId: comment.task_id, type: 'new_comment' });
            }
          });
        }

        // تحديث "وقت آخر فحص" ليكون الوقت الحالي
        lastCheckRef.current = now;

      } catch (error) {
        console.error("Error during polling for dashboard updates:", error);
      }
    };

    // تشغيل الفحص كل 10 ثوانٍ (10000 ميلي ثانية)
    const intervalId = setInterval(checkForUpdates, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, role]);
}
