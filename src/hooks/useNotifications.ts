import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useNotifications() {
  const { user, role } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");
  
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
// 1. أرشفة الإشعار في ذاكرة المتصفح (ليظهر في قائمة الجرس)
if (user) {
const saved = localStorage.getItem(app_notifs_${user.id});
const currentNotifs = saved ? JSON.parse(saved) : [];
const newNotif = {
id: Date.now().toString(),
title,
body,
data,
is_read: false,
created_at: new Date().toISOString()
};
// نحفظ آخر 50 إشعار فقط لكي لا يمتلئ المتصفح
localStorage.setItem(app_notifs_${user.id}, JSON.stringify([newNotif, ...currentNotifs].slice(0, 50)));
// إرسال إشارة لتحديث رقم الجرس فوراً
window.dispatchEvent(new Event("new_notification"));
}

// 2. إظهار الإشعار المرئي (Native)
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
    new Notification(title, { body, icon: "/favicon.ico", dir: "rtl" });
  }
}
};

  useEffect(() => {
    if (!user) return;

    const checkForUpdates = async () => {
      const now = new Date().toISOString();
      const lastCheck = lastCheckRef.current;

      // قراءة تفضيلات المستخدم من المتصفح لمعرفة ماذا يريد أن يستلم
      const savedPrefs = localStorage.getItem(`notif_prefs_${user.id}`);
      const prefs = savedPrefs ? JSON.parse(savedPrefs) : {
        newTasks: true,
        taskUpdates: true,
        newComments: true,
        leaveRequests: true,
      };

      try {
        // ==========================================
        // 1. مراقبة المهام (الجديدة والتحديثات)
        // ==========================================
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, status, created_at, updated_at, assigned_to, assigned_by")
          .gt("updated_at", lastCheck);

        if (tasks && tasks.length > 0) {
          tasks.forEach(task => {
            const isNew = task.created_at > lastCheck;
            
            // إذا كانت مهمة جديدة والمستخدم مفعل "إشعارات المهام الجديدة"
            if (isNew && task.assigned_to === user.id && prefs.newTasks) {
              toast.info("📋 مهمة جديدة", { description: task.title });
              showNativeNotification("مهمة جديدة وردت إليك", task.title, { taskId: task.id, type: 'new_task' });
            } 
            // إذا كانت تحديث لحالة مهمة والمستخدم مفعل "تحديثات المهام"
            else if (!isNew && (task.assigned_to === user.id || task.assigned_by === user.id) && prefs.taskUpdates) {
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
              showNativeNotification("تحديث في حالة المهمة", `${task.title} \nالحالة: ${statusAr}`, { taskId: task.id });
            }
          });
        }

        // ==========================================
        // 2. مراقبة التعليقات (مع جلب اسم المُعلِّق)
        // ==========================================
        if (prefs.newComments) {
          const { data: comments } = await supabase
            .from("task_comments")
            .select("*")
            .gt("created_at", lastCheck)
            .neq("user_id", user.id); 

          if (comments && comments.length > 0) {
            for (const comment of comments) {
              const { data: taskDetails } = await supabase
                .from("tasks")
                .select("title, assigned_to, assigned_by")
                .eq("id", comment.task_id)
                .maybeSingle();

              if (taskDetails && (taskDetails.assigned_to === user.id || taskDetails.assigned_by === user.id)) {
                
                // جلب اسم صاحب التعليق
                const { data: commenterProfile } = await supabase
                  .from("profiles")
                  .select("full_name")
                  .eq("user_id", comment.user_id)
                  .maybeSingle();
                
                const commenterName = commenterProfile?.full_name || "زميلك";

                toast.info("💬 تعليق جديد", { description: `${commenterName} علّق على: ${taskDetails.title}` });
                showNativeNotification("تعليق جديد", `${commenterName} أضاف تعليقاً على: ${taskDetails.title}`, { taskId: comment.task_id });
              }
            }
          }
        }

        // ==========================================
        // 3. مراقبة الإجازات
        // ==========================================
        const { data: leaves } = await supabase
          .from("leave_requests")
          .select("id, leave_type, status, created_at, updated_at, user_id")
          .gt("updated_at", lastCheck);

        if (leaves && leaves.length > 0) {
          leaves.forEach(req => {
            const isNew = req.created_at > lastCheck;
            const typeName = req.leave_type === "leave" ? "إجازة يومية" : "إجازة زمنية";

            // طلبات جديدة للمدير
            if (isNew && req.user_id !== user.id && (role === "admin" || role === "unit_head") && prefs.leaveRequests) {
              toast.info(`📝 طلب ${typeName} جديد`, { description: "يحتاج إلى مراجعتك واعتمادك" });
              showNativeNotification(`طلب ${typeName} جديد`, "يوجد طلب يحتاج إلى اتخاذ إجراء", { requestId: req.id });
            }
            // تحديثات للموظف (لا تحتاج لتفعيل خيار، تصل للموظف دائماً)
            else if (!isNew && req.user_id === user.id) {
              const statusAr = req.status === "approved" ? "موافق عليه ✅" : req.status === "rejected" ? "مرفوض ❌" : "قيد المراجعة";
              toast.success(`تحديث في طلب الـ ${typeName}`, { description: `حالة طلبك الآن: ${statusAr}` });
              showNativeNotification(`تحديث طلب الإجازة`, `تم تغيير حالة طلبك إلى: ${statusAr}`, { requestId: req.id });
            }
          });
        }

        lastCheckRef.current = now;

      } catch (error) {
        console.error("Error during polling:", error);
      }
    };

    const intervalId = setInterval(checkForUpdates, 10000);
    return () => clearInterval(intervalId);
  }, [user, role]);
}
