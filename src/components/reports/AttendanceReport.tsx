import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer } from "lucide-react";

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
  compliance_rate: number;
}

export default function AttendanceReport() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterDuty, setFilterDuty] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("monthly");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchReports(); }, [filterUnit, filterDuty, filterPeriod]);

  const fetchReports = async () => {
    setLoading(true);
    let profilesQuery = supabase.from("profiles").select("user_id, full_name, unit, duty_system");
    if (filterUnit !== "all") profilesQuery = profilesQuery.eq("unit", filterUnit as any);
    if (filterDuty !== "all") profilesQuery = profilesQuery.eq("duty_system", filterDuty as any);
    const { data: profiles } = await profilesQuery;
    if (!profiles) { setLoading(false); return; }

    const userIds = profiles.map(p => p.user_id);

    // Date range based on period
    const now = new Date();
    let startDate: string;
    if (filterPeriod === "daily") {
      startDate = now.toISOString().slice(0, 10);
    } else if (filterPeriod === "weekly") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = d.toISOString().slice(0, 10);
    }

    let attQuery = supabase.from("attendance").select("user_id, status").in("user_id", userIds).gte("date", startDate);
    const { data: attendance } = await attQuery;

    const currentMonth = now.toISOString().slice(0, 7) + "-01";
    const { data: balances } = await supabase.from("leave_balances").select("*").in("user_id", userIds).eq("month", currentMonth);

    const rows: ReportRow[] = profiles.map(p => {
      const att = (attendance ?? []).filter(a => a.user_id === p.user_id);
      const bal = (balances ?? []).find(b => b.user_id === p.user_id);
      const total = att.length || 1;
      const presentCount = att.filter(a => a.status === "present").length;
      return {
        full_name: p.full_name,
        unit: p.unit ?? "",
        duty_system: p.duty_system,
        present_count: presentCount,
        leave_count: att.filter(a => a.status === "leave").length,
        time_off_count: att.filter(a => a.status === "time_off").length,
        duty_count: att.filter(a => a.status === "duty").length,
        absent_count: att.filter(a => a.status === "absent").length,
        leave_days_remaining: bal ? Number(bal.leave_days_total) - Number(bal.leave_days_used) : 3,
        time_off_hours_remaining: bal ? Number(bal.time_off_hours_total) - Number(bal.time_off_hours_used) : 7,
        compliance_rate: Math.round((presentCount / total) * 100),
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
      <html dir="rtl"><head><title>تقرير الحضور</title>
      <style>
        body { font-family: 'Cairo', sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 12px; }
        th { background: #f0f0f0; }
        h1 { font-size: 18px; text-align: center; }
      </style></head><body>
      <h1>تقرير الحضور والانضباط</h1>
      <p style="text-align:center;color:#666;font-size:12px;">التاريخ: ${new Date().toLocaleDateString("ar-SA")}</p>
      ${printContent.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">يومي</SelectItem>
            <SelectItem value="weekly">أسبوعي</SelectItem>
            <SelectItem value="monthly">شهري</SelectItem>
          </SelectContent>
        </Select>
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
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" />طباعة
        </Button>
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
                  <TableHead className="text-right">نسبة الالتزام</TableHead>
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
                    <TableCell><Badge variant="outline">{r.leave_days_remaining} يوم</Badge></TableCell>
                    <TableCell><Badge variant="outline">{r.time_off_hours_remaining} ساعة</Badge></TableCell>
                    <TableCell>
                      <Badge className={r.compliance_rate >= 80 ? "bg-success/10 text-success" : r.compliance_rate >= 50 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}>
                        {r.compliance_rate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
