import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  ClipboardList, CalendarDays, Star, Timer, TrendingUp, CheckCircle2 
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
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. المهام النشطة
    const { count: tCount } = await supabase.from("tasks")
      .select("*", { count: 'exact', head: true })
      .eq("assigned_to", user?.id)
      .neq("status", "approved");

    // 2. الإجازات والزمنيات المعتمدة لهذا الشهر
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

    // 3. مجموع النقاط
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
        <div>
          <h1 className="text-2xl font-bold font-cairo text-primary">مرحباً، {fullName} 👋</h1>
          {role !== "individual" && (
            <p className="text-muted-foreground text-sm mt-1 italic font-medium border-r-2 border-primary pr-2">
              نظرة عامة على أداء القسم — تحديث لحظي
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* بطاقة المهام */}
          <Card 
            className="shadow-card border-0 cursor-pointer hover:bg-slate-50 transition-all hover:scale-[1.02]"
            onClick={() => navigate("/tasks")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-bold">مهامك النشطة</p>
                <p className="text-xl font-black">{stats.tasksCount}</p>
              </div>
            </CardContent>
          </Card>

          {/* بطاقة الإجازات */}
          <Card 
            className="shadow-card border-0 cursor-pointer hover:bg-slate-50 transition-all hover:scale-[1.02]"
            onClick={() => navigate("/hr?tab=requests&filter=leave")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-bold">إجازاتك (هذا الشهر)</p>
                <p className="text-xl font-black">{stats.approvedLeaves}</p>
              </div>
            </CardContent>
          </Card>

          {/* بطاقة الزمنيات */}
          <Card 
            className="shadow-card border-0 cursor-pointer hover:bg-slate-50 transition-all hover:scale-[1.02]"
            onClick={() => navigate("/hr?tab=requests&filter=time_off")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Timer className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-bold">ساعات الزمنيات</p>
                <p className="text-xl font-black">{stats.timeOffHours}</p>
              </div>
            </CardContent>
          </Card>

          {/* بطاقة النقاط */}
          <Card className="shadow-card border-0 bg-primary text-primary-foreground">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Star className="w-6 h-6 fill-white" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs opacity-90 font-bold">رصيد نقاطك</p>
                <p className="text-xl font-black">{stats.points}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* للأدوار الإدارية فقط: عرض نسب الإنجاز والتنبيهات */}
        {role !== "individual" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <Card className="shadow-card border-0">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold">إحصائيات الأداء العام</CardTitle>
              </CardHeader>
              <CardContent className="py-10 text-center text-muted-foreground text-xs italic">
                سيتم تفعيل الرسوم البيانية لأداء الشعب قريباً.
              </CardContent>
            </Card>
            
            <Card className="shadow-card border-0">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <CardTitle className="text-sm font-bold">تنبيهات الموارد البشرية</CardTitle>
              </CardHeader>
              <CardContent className="py-10 text-center text-muted-foreground text-xs italic">
                لا توجد بلاغات معلقة تتطلب إجراء فوري.
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
