import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, CheckCircle, XCircle, Undo2, Plus, User, Users } from "lucide-react";
import UserDossier from "@/components/hr/UserDossier";

const statusLabels: Record<string, string> = {
  pending: "معلّق", unit_head_approved: "موافق (مسؤول)", unit_head_rejected: "مرفوض (مسؤول)",
  admin_approved: "موافق نهائياً", admin_rejected: "مرفوض نهائياً",
};
const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning", unit_head_approved: "bg-info/10 text-info",
  unit_head_rejected: "bg-destructive/10 text-destructive", admin_approved: "bg-success/10 text-success",
  admin_rejected: "bg-destructive/10 text-destructive",
};
const unitLabels: Record<string, string> = { preparation: "شعبة الإعداد", curriculum: "شعبة المناهج" };

export default function HRPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({ leave_type: "leave", start_date: "", end_date: "", hours: "", reason: "" });
  const [attForm, setAttForm] = useState({ user_id: "", status: "present", notes: "" });
  const [applicantInfo, setApplicantInfo] = useState<any>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  // Users tab state
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersFilterUnit, setUsersFilterUnit] = useState("all");
  const [dossierOpen, setDossierOpen] = useState(false);
  const [dossierUser, setDossierUser] = useState<{ userId: string; fullName: string }>({ userId: "", fullName: "" });

  useEffect(() => { fetchData(); }, [role]);

  const fetchData = async () => {
    const { data: lr } = await supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
    setLeaveRequests(lr ?? []);
    const today = new Date().toISOString().slice(0, 10);
    const { data: att } = await supabase.from("attendance").select("*").eq("date", today);
    setAttendance(att ?? []);
    if (role === "admin" || role === "unit_head") {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, duty_system, unit");
      setMembers(profiles ?? []);
      setAllUsers(profiles ?? []);
    }
    setLoading(false);
  };

  const handleLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = { user_id: user!.id, leave_type: form.leave_type, start_date: form.start_date, reason: form.reason };
    if (form.leave_type === "leave") body.end_date = form.end_date;
    else body.hours = parseFloat(form.hours);
    const { error } = await supabase.from("leave_requests").insert(body);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم تقديم الطلب بنجاح" }); setDialogOpen(false); setForm({ leave_type: "leave", start_date: "", end_date: "", hours: "", reason: "" }); fetchData(); }
  };

  const fetchApplicantInfo = async (lr: any) => {
    setSelectedRequest(lr);
    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
    const { data: balance } = await supabase.from("leave_balances")
      .select("*").eq("user_id", lr.user_id).eq("month", currentMonth).maybeSingle();
    const startOfMonth = currentMonth;
    const endOfMonth = new Date(new Date(currentMonth).getFullYear(), new Date(currentMonth).getMonth() + 1, 0).toISOString().slice(0, 10);
    const { data: monthRequests } = await supabase.from("leave_requests")
      .select("*").eq("user_id", lr.user_id)
      .gte("start_date", startOfMonth).lte("start_date", endOfMonth)
      .neq("id", lr.id);
    const member = members.find(m => m.user_id === lr.user_id);
    setApplicantInfo({ name: member?.full_name ?? "—", balance, monthRequests: monthRequests ?? [] });
    setInfoDialogOpen(true);
  };

  const handleApproval = async (id: string, decision: string) => {
    const updates: any = {};
    if (role === "unit_head") {
      updates.unit_head_decision = decision;
      updates.unit_head_id = user!.id;
      updates.unit_head_date = new Date().toISOString();
      updates.status = decision;
    } else if (role === "admin") {
      updates.admin_decision = decision;
      updates.admin_id = user!.id;
      updates.admin_date = new Date().toISOString();
      updates.status = decision;
    }
    const { error } = await supabase.from("leave_requests").update(updates).eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم تحديث الطلب" }); setInfoDialogOpen(false); fetchData(); }
  };

  const handleUndo = async (id: string) => {
    const updates: any = { status: "pending" as any };
    if (role === "unit_head") {
      updates.unit_head_decision = null; updates.unit_head_id = null; updates.unit_head_date = null; updates.unit_head_notes = null;
    } else if (role === "admin") {
      updates.admin_decision = null; updates.admin_id = null; updates.admin_date = null; updates.admin_notes = null;
    }
    const { error } = await supabase.from("leave_requests").update(updates).eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم التراجع عن القرار" }); setInfoDialogOpen(false); fetchData(); }
  };

  const handleAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("attendance").upsert({
      user_id: attForm.user_id, date: new Date().toISOString().slice(0, 10),
      status: attForm.status as any, notes: attForm.notes,
    }, { onConflict: "user_id,date" });
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم تسجيل الحضور" }); setAttendanceDialog(false); fetchData(); }
  };

  const isDecisionMade = (lr: any) => {
    if (role === "unit_head") return lr.unit_head_decision && lr.unit_head_decision !== "pending";
    if (role === "admin") return lr.admin_decision && lr.admin_decision !== "pending";
    return false;
  };

  const filteredUsers = usersFilterUnit === "all" ? allUsers : allUsers.filter(u => u.unit === usersFilterUnit);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-cairo flex items-center gap-2">
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />الموارد البشرية
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">الحضور والإجازات ودورة الموافقة</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {(role === "admin" || role === "unit_head") && (
              <Dialog open={attendanceDialog} onOpenChange={setAttendanceDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-1 text-xs sm:text-sm sm:gap-2"><Clock className="w-4 h-4" /><span className="hidden sm:inline">تسجيل</span> حضور</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-cairo">تسجيل الحضور اليومي</DialogTitle></DialogHeader>
                  <form onSubmit={handleAttendance} className="space-y-4">
                    <div className="space-y-2">
                      <Label>العضو</Label>
                      <Select value={attForm.user_id} onValueChange={(v) => setAttForm({ ...attForm, user_id: v })}>
                        <SelectTrigger><SelectValue placeholder="اختر العضو" /></SelectTrigger>
                        <SelectContent>
                          {members.map((m) => (<SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>الحالة</Label>
                      <Select value={attForm.status} onValueChange={(v) => setAttForm({ ...attForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">حاضر</SelectItem>
                          <SelectItem value="leave">مجاز</SelectItem>
                          <SelectItem value="time_off">زمنية</SelectItem>
                          <SelectItem value="duty">واجب</SelectItem>
                          <SelectItem value="absent">غائب</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>ملاحظات</Label>
                      <Textarea value={attForm.notes} onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })} />
                    </div>
                    <Button type="submit" className="w-full gradient-primary text-white">تسجيل</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-white gap-2"><Plus className="w-4 h-4" />طلب إجازة</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-cairo">طلب إجازة / زمنية</DialogTitle></DialogHeader>
                <form onSubmit={handleLeaveRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label>النوع</Label>
                    <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leave">إجازة (يوم)</SelectItem>
                        <SelectItem value="time_off">زمنية (ساعات)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ البداية</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
                  </div>
                  {form.leave_type === "leave" && (
                    <div className="space-y-2">
                      <Label>تاريخ النهاية</Label>
                      <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
                    </div>
                  )}
                  {form.leave_type === "time_off" && (
                    <div className="space-y-2">
                      <Label>عدد الساعات</Label>
                      <Input type="number" step="0.5" min="0.5" max="7" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>السبب</Label>
                    <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-white">تقديم الطلب</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="requests" className="w-full">
          <TabsList>
            <TabsTrigger value="requests">طلبات الإجازات</TabsTrigger>
            <TabsTrigger value="attendance">سجل الحضور</TabsTrigger>
            {(role === "admin" || role === "unit_head") && (
              <TabsTrigger value="users" className="gap-1"><Users className="w-4 h-4" />عرض المستخدمين</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="requests">
            <Card className="shadow-card border-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">مسؤول الشعبة</TableHead>
                      <TableHead className="text-right">المدير</TableHead>
                      {(role === "admin" || role === "unit_head") && <TableHead className="text-right">إجراء</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد طلبات</TableCell></TableRow>
                    ) : leaveRequests.map((lr) => (
                      <TableRow key={lr.id}>
                        <TableCell>{lr.leave_type === "leave" ? "إجازة" : `زمنية (${lr.hours} ساعة)`}</TableCell>
                        <TableCell>{lr.start_date}{lr.end_date ? ` → ${lr.end_date}` : ""}</TableCell>
                        <TableCell><Badge className={statusColors[lr.status] ?? ""}>{statusLabels[lr.status] ?? lr.status}</Badge></TableCell>
                        <TableCell>{statusLabels[lr.unit_head_decision] ?? "—"}</TableCell>
                        <TableCell>{statusLabels[lr.admin_decision] ?? "—"}</TableCell>
                        {(role === "admin" || role === "unit_head") && (
                          <TableCell>
                            <div className="flex gap-1">
                              {(lr.status === "pending" || (role === "admin" && lr.status === "unit_head_approved")) && (
                                <Button size="sm" variant="ghost" className="text-info h-7 gap-1" onClick={() => fetchApplicantInfo(lr)}>
                                  <User className="w-3 h-3" />مراجعة
                                </Button>
                              )}
                              {isDecisionMade(lr) && (
                                <Button size="sm" variant="ghost" className="text-warning h-7 gap-1" onClick={() => handleUndo(lr.id)}>
                                  <Undo2 className="w-3 h-3" />تراجع
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card className="shadow-card border-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">لا توجد سجلات اليوم</TableCell></TableRow>
                    ) : attendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {a.status === "present" ? "حاضر" : a.status === "leave" ? "مجاز" : a.status === "time_off" ? "زمنية" : a.status === "duty" ? "واجب" : "غائب"}
                          </Badge>
                        </TableCell>
                        <TableCell>{a.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {(role === "admin" || role === "unit_head") && (
            <TabsContent value="users">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Select value={usersFilterUnit} onValueChange={setUsersFilterUnit}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="فلتر الشعبة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الشعب</SelectItem>
                      <SelectItem value="preparation">شعبة الإعداد</SelectItem>
                      <SelectItem value="curriculum">شعبة المناهج</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Card className="shadow-card border-0">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">الاسم</TableHead>
                          <TableHead className="text-right">الشعبة</TableHead>
                          <TableHead className="text-right">إجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">لا يوجد مستخدمون</TableCell></TableRow>
                        ) : filteredUsers.map(u => (
                          <TableRow key={u.user_id}>
                            <TableCell className="font-medium">{u.full_name}</TableCell>
                            <TableCell>{unitLabels[u.unit] ?? "—"}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 text-primary"
                                onClick={() => { setDossierUser({ userId: u.user_id, fullName: u.full_name }); setDossierOpen(true); }}
                              >
                                <User className="w-3 h-3" />عرض الملف
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Applicant Info & Approval Dialog */}
        <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-cairo">بيانات مقدم الطلب</DialogTitle></DialogHeader>
            {applicantInfo && selectedRequest && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-bold text-lg">{applicantInfo.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.leave_type === "leave" ? "إجازة" : "زمنية"} - {selectedRequest.start_date}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">رصيد الإجازات</p>
                    <p className="text-2xl font-bold text-primary">
                      {applicantInfo.balance ? (applicantInfo.balance.leave_days_total - applicantInfo.balance.leave_days_used) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">يوم متبقي</p>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">رصيد الزمنية</p>
                    <p className="text-2xl font-bold text-secondary">
                      {applicantInfo.balance ? (applicantInfo.balance.time_off_hours_total - applicantInfo.balance.time_off_hours_used) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">ساعة متبقية</p>
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-sm font-medium mb-2">سجل الشهر الحالي</p>
                  {applicantInfo.monthRequests.length === 0 ? (
                    <p className="text-xs text-muted-foreground">لا توجد طلبات سابقة هذا الشهر</p>
                  ) : (
                    <div className="space-y-1">
                      {applicantInfo.monthRequests.map((r: any) => (
                        <div key={r.id} className="flex justify-between text-xs">
                          <span>{r.leave_type === "leave" ? "إجازة" : "زمنية"} - {r.start_date}</span>
                          <Badge className={`text-xs ${statusColors[r.status]}`}>{statusLabels[r.status]}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 gap-1 bg-success hover:bg-success/90 text-white"
                    onClick={() => handleApproval(selectedRequest.id, role === "admin" ? "admin_approved" : "unit_head_approved")}>
                    <CheckCircle className="w-4 h-4" />موافقة
                  </Button>
                  <Button variant="outline" className="flex-1 gap-1 text-destructive border-destructive"
                    onClick={() => handleApproval(selectedRequest.id, role === "admin" ? "admin_rejected" : "unit_head_rejected")}>
                    <XCircle className="w-4 h-4" />رفض
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* User Dossier */}
        <UserDossier
          userId={dossierUser.userId}
          fullName={dossierUser.fullName}
          open={dossierOpen}
          onOpenChange={setDossierOpen}
        />
      </div>
    </AppLayout>
  );
}
