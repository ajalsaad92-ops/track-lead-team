import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Printer, Filter } from "lucide-react";

const dutyLabels: Record<string, string> = { daily: "يومي", shift_77: "بديل 77", shift_1515: "بديل 1515" };
const unitLabels: Record<string, string> = { preparation: "شعبة الإعداد", curriculum: "شعبة المناهج" };

interface ReportRow {
  full_name: string;
  unit: string;
  duty_system: string;
  present_count: number;
  leave_count: number;
  time_off_count: number;
  duty_count: number;
  absent_count: number;
  leave_days_remaining: number;
  time_off_hours_remaining: number;
  points: number;
}

export default function ReportsPage() {
  const { role } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterDuty, setFilterDuty] = useState("all");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchReports(); }, [filterUnit, filterDuty]);

  const fetchReports = async () => {
    setLoading(true);
    let profilesQuery = supabase.from("profiles").select("user_id, full_name, unit, duty_system");
    if (filterUnit !== "all") profilesQuery = profilesQuery.eq("unit", filterUnit as any);
    if (filterDuty !== "all") profilesQuery = profilesQuery.eq("duty_system", filterDuty as any);
    const { data: profiles } = await profilesQuery;
    if (!profiles) { setLoading(false); return; }

    const userIds = profiles.map((p) => p.user_id);

    // Attendance counts
    const { data: attendance } = await supabase.from("attendance").select("user_id, status").in("user_id", userIds);
    // Leave balances
    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
    const { data: balances } = await supabase.from("leave_balances").select("*").in("user_id", userIds).eq("month", currentMonth);
    // Points
    const { data: tasks } = await supabase.from("tasks").select("assigned_to, points_awarded").in("assigned_to", userIds).eq("status", "approved");

    const rows: ReportRow[] = profiles.map((p) => {
      const att = (attendance ?? []).filter((a: any) => a.user_id === p.user_id);
      const bal = (balances ?? []).find((b: any) => b.user_id === p.user_id);
      const pts = (tasks ?? []).filter((t: any) => t.assigned_to === p.user_id);
      return {
        full_name: p.full_name,
        unit: p.unit ?? "",
        duty_system: p.duty_system,
        present_count: att.filter((a: any) => a.status === "present").length,
        leave_count: att.filter((a: any) => a.status === "leave").length,
        time_off_count: att.filter((a: any) => a.status === "time_off").length,
        duty_count: att.filter((a: any) => a.status === "duty").length,
        absent_count: att.filter((a: any) => a.status === "absent").length,
        leave_days_remaining: bal ? Number(bal.leave_days_total) - Number(bal.leave_days_used) : 3,
        time_off_hours_remaining: bal ? Number(bal.time_off_hours_total) - Number(bal.time_off_hours_used) : 7,
        points: pts.reduce((s: number, t: any) => s + (t.points_awarded || 0), 0),
      };
    });
    setReports(rows);
    setLoading(false);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><title>تقرير</title>
      <style>
        body { font-family: 'Cairo', sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 12px; }
        th { background: #f0f0f0; }
        h1 { font-size: 18px; text-align: center; }
        .meta { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
        .signature { margin-top: 60px; display: flex; justify-content: space-between; }
        .signature div { text-align: center; width: 30%; border-top: 1px solid #333; padding-top: 8px; }
      </style></head><body>
      <h1>تقرير قسم التدريب</h1>
      <p class="meta">التاريخ: ${new Date().toLocaleDateString("ar-SA")}</p>
      ${printContent.innerHTML}
      <div class="signature">
        <div>مدير القسم</div>
        <div>مسؤول الشعبة</div>
        <div>المعدّ</div>
      </div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold font-cairo flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              التقارير
            </h2>
            <p className="text-sm text-muted-foreground">تقارير شاملة مع إمكانية الطباعة</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterUnit} onValueChange={setFilterUnit}>
              <SelectTrigger className="w-36"><SelectValue placeholder="الشعبة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الشعب</SelectItem>
                <SelectItem value="preparation">شعبة الإعداد</SelectItem>
                <SelectItem value="curriculum">شعبة المناهج</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDuty} onValueChange={setFilterDuty}>
              <SelectTrigger className="w-32"><SelectValue placeholder="النظام" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="daily">يومي</SelectItem>
                <SelectItem value="shift_77">بديل 77</SelectItem>
                <SelectItem value="shift_1515">بديل 1515</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handlePrint} className="gradient-primary text-white gap-2">
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
          </div>
        </div>

        <Card className="shadow-card border-0">
          <CardContent className="p-0" ref={printRef}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الشعبة</TableHead>
                    <TableHead className="text-right">النظام</TableHead>
                    <TableHead className="text-right">حضور</TableHead>
                    <TableHead className="text-right">إجازات</TableHead>
                    <TableHead className="text-right">زمنيات</TableHead>
                    <TableHead className="text-right">واجبات</TableHead>
                    <TableHead className="text-right">غياب</TableHead>
                    <TableHead className="text-right">رصيد إجازات</TableHead>
                    <TableHead className="text-right">رصيد زمنيات</TableHead>
                    <TableHead className="text-right">النقاط</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                  ) : reports.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                  ) : reports.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell>{unitLabels[r.unit] ?? "—"}</TableCell>
                      <TableCell>{dutyLabels[r.duty_system] ?? "—"}</TableCell>
                      <TableCell>{r.present_count}</TableCell>
                      <TableCell>{r.leave_count}</TableCell>
                      <TableCell>{r.time_off_count}</TableCell>
                      <TableCell>{r.duty_count}</TableCell>
                      <TableCell>{r.absent_count}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.leave_days_remaining} يوم</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.time_off_hours_remaining} ساعة</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-success/10 text-success">{r.points}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
