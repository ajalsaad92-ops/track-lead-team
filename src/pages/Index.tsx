import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import NewTaskAlert from "@/components/dashboard/NewTaskAlert"; // استيراد المكون الذي أرسلته

// داخل المكون الرئيسي للوحة القيادة
export default function Dashboard() {
  const { user, role } = useAuth();
  const [latestTask, setLatestTask] = useState<any>(null);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // دالة جلب آخر مهمة غير منجزة للتنبيه بها
    const fetchLatestTask = async () => {
      let query = supabase
        .from("tasks")
        .select("id, title, status, created_at, is_visible_to_unit_head, unit")
        .order("created_at", { ascending: false })
        .limit(1);

      // تطبيق منطق الخصوصية في التنبيهات أيضاً
      if (role === "individual") {
        query = query.eq("assigned_to", user.id).eq("status", "assigned");
      } else if (role === "unit_head") {
        const { data: profile } = await supabase.from("profiles").select("unit").eq("user_id", user.id).single();
        // ينبه رئيس الشعبة فقط إذا كانت المهمة موجهة له أو لأفراد شعبته ولم يحظرها المدير
        query = query.or(`assigned_to.eq.${user.id},and(unit.eq.${profile?.unit},is_visible_to_unit_head.eq.true)`)
                     .eq("status", "assigned");
      }

      const { data, error } = await query;

      if (data && data.length > 0) {
        // التحقق مما إذا كان التنبيه قد عُرض مسبقاً في هذه الجلسة (اختياري)
        const lastNotifiedId = sessionStorage.getItem("last_notified_task_id");
        if (lastNotifiedId !== data[0].id) {
          setLatestTask(data[0]);
          setShowAlert(true);
        }
      }
    };

    fetchLatestTask();
  }, [user, role]);

  const handleDismissAlert = () => {
    if (latestTask) {
      sessionStorage.setItem("last_notified_task_id", latestTask.id);
    }
    setShowAlert(false);
  };

  return (
    <div className="space-y-6">
      {/* عرض التنبيه في أعلى لوحة القيادة إذا وجدت مهمة جديدة */}
      {showAlert && latestTask && (
        <NewTaskAlert 
          title={latestTask.title} 
          onDismiss={handleDismissAlert} 
        />
      )}

      {/* باقي محتويات لوحة القيادة (الإحصائيات، الرسوم البيانية، إلخ) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* المكونات الأخرى هنا */}
      </div>
    </div>
  );
}
