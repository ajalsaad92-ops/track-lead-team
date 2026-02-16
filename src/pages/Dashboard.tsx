import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarDays, BookOpen, ClipboardList, BarChart3, Clock, Award, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import NewTaskAlert from "@/components/dashboard/NewTaskAlert";
import IncompleteCurriculaAlert from "@/components/dashboard/IncompleteCurriculaAlert";

const COLORS = ["hsl(217,91%,50%)", "hsl(262,83%,58%)", "hsl(168,76%,42%)", "hsl(38,92%,50%)", "hsl(0,84%,60%)"];

interface CurriculumGap {
  id: string;
  title: string;
  missingFields: string[];
}

export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, leave: 0, time_off: 0, duty: 0, absent: 0 });
  const [taskSummary, setTaskSummary] = useState({ assigned: 0, in_progress: 0, completed: 0, approved: 0 });
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [balance, setBalance] = useState({ leave_days: 3, time_off_hours: 7, points: 0 });
  const [popupData, setPopupData] = useState<{ title: string; items: any[] } | null>(null);
  const [curriculaGaps, setCurriculaGaps] = useState<CurriculumGap[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!role) return;
    const today = new Date().toISOString().slice(0, 10);

    // Attendance
    if (role === "admin" || role === "unit_head") {
      const { data: allProfiles } = await supabase.from("profiles").select("user_id, full_name");
      const totalUsers = allProfiles?.length ?? 0;
      const { data: att } = await supabase.from("attendance").select("status, user_id").eq("date", today);
      const nonPresentMap: Record<string, string> = {};
      (att ?? []).forEach((a: any) => { if (a.status !== "present") nonPresentMap[a.user_id] = a.status; });
      const summary = { present: 0, leave: 0, time_off: 0, duty: 0, absent: 0 };
      Object.values(nonPresentMap).forEach(status => { if (status in summary) summary[status as keyof typeof summary]++; });
      summary.present = totalUsers - Object.values(nonPresentMap).length;
      setAttendanceSummary(summary);
    }

    // Tasks
    const { data: tasks } = await supabase.from("tasks").select("status");
    if (tasks) {
      const ts = { assigned: 0, in_progress: 0, completed: 0, approved: 0 };
      tasks.forEach((t: any) => {
        if (t.status === "assigned") ts.assigned++;
        else if (t.status === "in_progress") ts.in_progress++;
        else if (t.status === "completed" || t.status === "under_review") ts.completed++;
        else if (t.status === "approved") ts.approved++;
      });
      setTaskSummary(ts);
    }

    // Pending leaves
    if (role === "admin" || role === "unit_head") {
      const { data: leaves } = await supabase
        .from("leave_requests").select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }).limit(5);
      setPendingLeaves(leaves ?? []);
    }

    // Curricula gaps
    const checkFields = ["trainer", "location", "hours", "objectives", "target_groups", "prepared_by", "executing_entity"] as const;
    const { data: curricula } = await supabase.from("curricula").select("id, title, trainer, location, hours, objectives, target_groups, prepared_by, executing_entity");
    if (curricula) {
      const gaps: CurriculumGap[] = [];
      curricula.forEach((c: any) => {
        const missing = checkFields.filter(f => !c[f] || c[f] === "");
        if (missing.length > 0) gaps.push({ id: c.id, title: c.title, missingFields: [...missing] });
      });
      setCurriculaGaps(gaps);
    }

    // Individual balance
    if (role === "individual" && user) {
      const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
      const { data: bal } = await supabase
        .from("leave_balances").select("*")
        .eq("user_id", user.id).eq("month", currentMonth).maybeSingle();
      if (bal) {
        setBalance({
          leave_days: Number(bal.leave_days_total) - Number(bal.leave_days_used),
          time_off_hours: Number(bal.time_off_hours_total) - Number(bal.time_off_hours_used),
          points: 0,
        });
      }
      const { data: pts } = await supabase.from("tasks").select("points_awarded").eq("assigned_to", user.id).eq("status", "approved");
      if (pts) setBalance((b) => ({ ...b, points: pts.reduce((s: number, t: any) => s + (t.points_awarded || 0), 0) }));
    }
  }, [role, user]);

  useEffect(() => {
    if (role) fetchDashboardData();
  }, [role, fetchDashboardData]);

  // Realtime subscription
  const { newTaskAlert, dismissAlert } = useDashboardRealtime(fetchDashboardData);

  const statCards = role === "individual"
    ? [
        { label: "الإجازات المتبقية", value: `${balance.leave_days} يوم`, icon: CalendarDays, color: "bg-warning/10 text-warning" },
        { label: "الزمنيات المتبقية", value: `${balance.time_off_hours} ساعة`, icon: Clock, color: "bg-info/10 text-info" },
        { label: "نقاط الإنجاز", value: `${balance.points}`, icon: Award, color: "bg-success/10 text-success" },
        { label: "مهامي", value: `${taskSummary.assigned + taskSummary.in_progress}`, icon: ClipboardList, color: "bg-secondary/10 text-secondary" },
      ]
    : [
        { label: "الحضور", value: `${attendanceSummary.present}`, icon: Users, color: "bg-primary/10 text-primary", onClick: () => showPopup("الحاضرون", "present") },
        { label: "المجازين", value: `${attendanceSummary.leave}`, icon: CalendarDays, color: "bg-warning/10 text-warning", onClick: () => showPopup("المجازين", "leave") },
        { label: "الزمنيات", value: `${attendanceSummary.time_off}`, icon: Clock, color: "bg-info/10 text-info", onClick: () => showPopup("الزمنيات", "time_off") },
        { label: "الغياب", value: `${attendanceSummary.absent}`, icon: AlertTriangle, color: "bg-destructive/10 text-destructive", onClick: () => showPopup("الغياب", "absent") },
      ];

  const showPopup = async (title: string, status: string) => {
    const today = new Date().toISOString().slice(0, 10);
    if (status === "present") {
      const { data: allProfiles } = await supabase.from("profiles").select("user_id, full_name, duty_system");
      const { data: att } = await supabase.from("attendance").select("user_id, status").eq("date", today);
      const nonPresentIds = new Set((att ?? []).filter((a: any) => a.status !== "present").map((a: any) => a.user_id));
      const presentUsers = (allProfiles ?? []).filter(p => !nonPresentIds.has(p.user_id));
      setPopupData({ title, items: presentUsers.map(p => ({ profiles: { full_name: p.full_name, duty_system: p.duty_system } })) });
    } else {
      const { data } = await supabase.from("attendance").select("user_id").eq("date", today).eq("status", status as any);
      const userIds = (data ?? []).map((d: any) => d.user_id);
      if (userIds.length === 0) { setPopupData({ title, items: [] }); return; }
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, duty_system").in("user_id", userIds);
      setPopupData({ title, items: (profiles ?? []).map(p => ({ profiles: { full_name: p.full_name, duty_system: p.duty_system } })) });
    }
  };

  const taskPieData = [
    { name: "لم تبدأ", value: taskSummary.assigned, color: COLORS[3] },
    { name: "قيد التنفيذ", value: taskSummary.in_progress, color: COLORS[0] },
    { name: "مكتملة", value: taskSummary.completed, color: COLORS[2] },
    { name: "معتمدة", value: taskSummary.approved, color: COLORS[1] },
  ].filter((d) => d.value > 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold font-cairo">لوحة القيادة</h2>
          <p className="text-sm text-muted-foreground">نظرة عامة على أداء القسم — تحديث لحظي</p>
        </div>

        {/* New Task Alert */}
        {newTaskAlert && (
          <NewTaskAlert title={newTaskAlert.title} onDismiss={dismissAlert} />
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((stat) => (
            <Card
              key={stat.label}
              className="shadow-card border-0 hover:shadow-elevated transition-shadow cursor-pointer"
              onClick={"onClick" in stat ? stat.onClick : undefined}
            >
              <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                  <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="shadow-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                نسب الإنجاز
              </CardTitle>
            </CardHeader>
            <CardContent>
              {taskPieData.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width={150} height={150}>
                    <PieChart>
                      <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" stroke="none">
                        {taskPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {taskPieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-bold">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">لا توجد مهام بعد</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-warning" />
                تنبيهات الموارد البشرية
                {pendingLeaves.length > 0 && (
                  <Badge className="bg-destructive text-destructive-foreground mr-auto">{pendingLeaves.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingLeaves.length > 0 ? (
                <div className="space-y-2">
                  {pendingLeaves.map((lr: any) => (
                    <div key={lr.id} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                      <div>
                        <span className="font-medium">{lr.leave_type === "leave" ? "إجازة" : "زمنية"}</span>
                        <span className="text-muted-foreground mr-2">{lr.start_date}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate("/hr")}>مراجعة</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">لا توجد طلبات معلّقة</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Incomplete Curricula Alerts - enhanced for individuals */}
        {curriculaGaps.length > 0 && role === "individual" && (
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm font-medium text-warning flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            مهمة تلقائية لإكمال بيانات — لديك {curriculaGaps.length} منهاج يحتاج لإكمال بيانات ناقصة
          </div>
        )}
        <IncompleteCurriculaAlert gaps={curriculaGaps} />

        {/* Popup for attendance details */}
        <Dialog open={!!popupData} onOpenChange={() => setPopupData(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-cairo">{popupData?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {popupData?.items?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
              ) : (
                popupData?.items?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                    <span>{item.profiles?.full_name ?? "—"}</span>
                    <Badge variant="outline">
                      {item.profiles?.duty_system === "daily" ? "يومي" : item.profiles?.duty_system === "shift_77" ? "بديل 77" : "بديل 1515"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
