import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  ClipboardList, Users, CalendarDays, TrendingUp, 
  CheckCircle2, Clock, AlertCircle, Star 
} from "lucide-react";

export default function Dashboard() {
  const { user, role, fullName } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    tasksCount: 0,
    approvedLeaves: 0,
    timeOffHours: 0,
    points: 0
  });

  useEffect(() => {
    if (!user) return;
    fetchDashboardStats();
  }, [user]);

  const fetchDashboardStats = async () => {
    // جلب إحصائيات الشهر الحالي فقط
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. المهام (قيد التنفيذ)
    const { count: tCount } = await supabase.from("tasks")
      .select("*", { count: 'exact', head: true })
      .eq("assigned_to", user?.id)
      .neq("status", "approved");

    // 2. الإجازات والزمنيات
    const { data: lr } = await supabase.from("leave_requests")
      .select("*")
      .eq("user_id", user?.id)
      .eq("status", "admin_approved")
      .gte("start_date", startOfMonth);

    let leaves = 0;
    let hours = 0;
    lr?.forEach(r => {
      if (r.leave_type === 'leave') leaves++;
      else if (r.leave_type === 'time_off') hours += (r.hours || 0);
    });

    // 3. النقاط
    const { data: approvedTasks } = await supabase.from("tasks")
      .select("points_awarded")
      .eq("assigned_to", user?.id)
      .eq("status", "approved");
    
    const totalPoints = approvedTasks?.reduce((acc, curr) => acc + (curr.points_awarded || 0), 0) || 0;

    setStats({
      tasksCount: tCount || 0,
      approvedLeaves: leaves,
      timeOffHours: hours,
      points: totalPoints
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* هيدر ترحيبي مخصص */}
        <div>
          <h1 className="text-2xl font-bold font-cairo">مرحباً، {fullName} 👋</h1>
          {role !== "individual" && (
            <p className="text-muted-foreground text-sm mt-1">نظرة عامة على أداء القسم — تحديث لحظي</p>
          )}
        </div>

        {/* بطاقات الإحصائيات التفاعلية */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className="shadow-card border-0 cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => navigate("/tasks")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">مهامك النشطة</p>
                <p className="text-xl font-bold">{stats.tasksCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="shadow-card border-0 cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => navigate("/hr?tab=requests&filter=leave")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجازات هذا الشهر</p>
                <p className="text-xl font-bold">{stats.approvedLeaves}</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="shadow-card border-0 cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => navigate("/hr?tab=requests&filter=time_off")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Timer className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ساعات الزمنيات</p>
                <p className="text-xl font-bold">{stats.timeOffHours}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-0 bg-primary text-primary-foreground">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Star className="w-6 h-6 fill-white" />
              </div>
              <div>
                <p className="text-xs opacity-80">نقاط الإنجاز</p>
                <p className="text-xl font-bold">{stats.points}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* للأدوار الإدارية فقط: عرض نسب الإنجاز */}
        {role !== "individual" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-card border-0">
              <CardHeader><CardTitle className="text-base font-bold">تنبيهات الموارد البشرية</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground text-center py-10">
                لا توجد تنبيهات عاجلة حالياً.
              </CardContent>
            </Card>
            
            <Card className="shadow-card border-0">
              <CardHeader><CardTitle className="text-base font-bold">إحصائيات الأداء العام</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground text-center py-10">
                سيتم تفعيل الرسوم البيانية هنا قريباً.
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
