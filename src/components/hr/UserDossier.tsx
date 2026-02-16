import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, CheckCircle, Clock, AlertTriangle, Award, BookOpen } from "lucide-react";

interface UserDossierProps {
  userId: string;
  fullName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const taskStatusLabels: Record<string, string> = {
  assigned: "مكلّف", in_progress: "قيد التنفيذ", completed: "مكتمل",
  under_review: "قيد المراجعة", approved: "معتمد", suspended: "معلّق",
};

export default function UserDossier({ userId, fullName, open, onOpenChange }: UserDossierProps) {
  const [loading, setLoading] = useState(true);
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, leave: 0, time_off: 0, duty: 0, absent: 0 });
  const [leaveBalance, setLeaveBalance] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [curricula, setCurricula] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    if (open && userId) fetchAll();
  }, [open, userId]);

  const fetchAll = async () => {
    setLoading(true);

    const [attRes, balRes, taskRes, currRes, ptsRes] = await Promise.all([
      supabase.from("attendance").select("status").eq("user_id", userId),
      supabase.from("leave_balances").select("*").eq("user_id", userId)
        .eq("month", new Date().toISOString().slice(0, 7) + "-01").maybeSingle(),
      supabase.from("tasks").select("*").eq("assigned_to", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("curricula").select("id, title, stage, created_at").eq("created_by", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("tasks").select("points_awarded").eq("assigned_to", userId).eq("status", "approved"),
    ]);

    // Attendance summary
    const att = attRes.data ?? [];
    setAttendanceSummary({
      present: att.filter(a => a.status === "present").length,
      leave: att.filter(a => a.status === "leave").length,
      time_off: att.filter(a => a.status === "time_off").length,
      duty: att.filter(a => a.status === "duty").length,
      absent: att.filter(a => a.status === "absent").length,
    });

    setLeaveBalance(balRes.data);
    setTasks(taskRes.data ?? []);
    setCurricula(currRes.data ?? []);
    setTotalPoints((ptsRes.data ?? []).reduce((s, t) => s + (t.points_awarded || 0), 0));
    setLoading(false);
  };

  const now = new Date();
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < now && !["approved", "completed"].includes(t.status));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-cairo text-lg">{fullName} — الملف الشخصي المتكامل</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Attendance Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="w-4 h-4" />موقف الحضور</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: "حضور", value: attendanceSummary.present, color: "text-success" },
                    { label: "إجازات", value: attendanceSummary.leave, color: "text-warning" },
                    { label: "زمنيات", value: attendanceSummary.time_off, color: "text-info" },
                    { label: "واجبات", value: attendanceSummary.duty, color: "text-primary" },
                    { label: "غياب", value: attendanceSummary.absent, color: "text-destructive" },
                  ].map(item => (
                    <div key={item.label} className="p-2 border rounded-lg">
                      <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
                {leaveBalance && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="p-2 border rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">رصيد إجازات متبقي</p>
                      <p className="text-lg font-bold text-primary">{leaveBalance.leave_days_total - leaveBalance.leave_days_used} يوم</p>
                    </div>
                    <div className="p-2 border rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">رصيد زمنيات متبقي</p>
                      <p className="text-lg font-bold text-secondary">{leaveBalance.time_off_hours_total - leaveBalance.time_off_hours_used} ساعة</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Points */}
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Award className="w-8 h-8 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">مجموع النقاط</p>
                  <p className="text-2xl font-bold text-warning">{totalPoints}</p>
                </div>
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />سجل المهام
                  {overdueTasks.length > 0 && (
                    <Badge variant="destructive" className="text-xs mr-2">
                      <AlertTriangle className="w-3 h-3 ml-1" />{overdueTasks.length} متأخرة
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المهمة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الموعد</TableHead>
                      <TableHead className="text-right">النقاط</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-sm">لا توجد مهام</TableCell></TableRow>
                    ) : tasks.map(t => {
                      const isOverdue = t.due_date && new Date(t.due_date) < now && !["approved", "completed"].includes(t.status);
                      return (
                        <TableRow key={t.id} className={isOverdue ? "bg-destructive/5" : ""}>
                          <TableCell className="text-sm">{t.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {taskStatusLabels[t.status] ?? t.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {t.due_date ? new Date(t.due_date).toLocaleDateString("ar-SA") : "—"}
                            {isOverdue && <AlertTriangle className="w-3 h-3 text-destructive inline mr-1" />}
                          </TableCell>
                          <TableCell className="text-sm">{t.points_awarded || 0}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Curricula */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4" />سجل الإنجازات (المناهج)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المنهج</TableHead>
                      <TableHead className="text-right">المرحلة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {curricula.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">لا توجد مناهج</TableCell></TableRow>
                    ) : curricula.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{c.title}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{c.stage}</Badge></TableCell>
                        <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString("ar-SA")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
