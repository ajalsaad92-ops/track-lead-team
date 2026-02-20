import { useState, useEffect } from "react";import { supabase } from "@/integrations/supabase/client";import { useAuth } from "@/hooks/useAuth";import AppLayout from "@/components/AppLayout";import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";import { Button } from "@/components/ui/button";import { Input } from "@/components/ui/input";import { Label } from "@/components/ui/label";import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";import { Badge } from "@/components/ui/badge";import { Textarea } from "@/components/ui/textarea";import { useToast } from "@/hooks/use-toast";import {CalendarDays, Clock, CheckCircle, XCircle, Undo2, Plus, User,Users, Activity, ChevronDown, FileText, Timer, LogOut, ClipboardList, HeartHandshake, Search, X, AlertCircle} from "lucide-react";import UserDossier from "@/components/hr/UserDossier";import { useIsMobile } from "@/hooks/use-mobile";const statusLabels: Record<string, string> = {pending: "معلّق", unit_head_approved: "موافق (مسؤول)", unit_head_rejected: "مرفوض (مسؤول)",admin_approved: "موافق نهائياً", admin_rejected: "مرفوض نهائياً",};const statusColors: Record<string, string> = {pending: "bg-warning/10 text-warning border border-warning/30",unit_head_approved: "bg-info/10 text-info border border-info/30",unit_head_rejected: "bg-destructive/10 text-destructive border border-destructive/30",admin_approved: "bg-success/10 text-success border border-success/30",admin_rejected: "bg-destructive/10 text-destructive border border-destructive/30",};const unitLabels: Record<string, string> = { preparation: "شعبة الإعداد", curriculum: "شعبة المناهج" };const requestTypeLabels: Record<string, string> = {leave: "إجازة اعتيادية",time_off: "زمنية",exit: "خروجية",task_request: "طلب مهمة",personal: "طلب شخصي",};const requestTypeIcons: Record<string, typeof CalendarDays> = {leave: CalendarDays, time_off: Timer, exit: LogOut,task_request: ClipboardList, personal: HeartHandshake,};// 🔴 ثوابت الأرصدة الشهريةconst MONTHLY_LEAVE_DAYS = 3;const MONTHLY_TIME_OFF_HOURS = 12;export default function HRPage() {const { user, role } = useAuth();const { toast } = useToast();const isMobile = useIsMobile();const [leaveRequests, setLeaveRequests] = useState<any[]>([]);const [attendance, setAttendance] = useState<any[]>([]);const [dialogOpen, setDialogOpen] = useState(false);const [requestType, setRequestType] = useState("leave");const [attendanceDialog, setAttendanceDialog] = useState(false);const [loading, setLoading] = useState(true);const [members, setMembers] = useState<any[]>([]);const [form, setForm] = useState({ leave_type: "leave", start_date: "", end_date: "", hours: "", reason: "" });const [attForm, setAttForm] = useState({ user_id: "", status: "present", notes: "" });const [applicantInfo, setApplicantInfo] = useState<any>(null);const [infoDialogOpen, setInfoDialogOpen] = useState(false);const [selectedRequest, setSelectedRequest] = useState<any>(null);const [search, setSearch] = useState("");const [allUsers, setAllUsers] = useState<any[]>([]);const [usersFilterUnit, setUsersFilterUnit] = useState("all");const [dossierOpen, setDossierOpen] = useState(false);const [dossierUser, setDossierUser] = useState<{ userId: string; fullName: string }>({ userId: "", fullName: "" });const [activityLogs, setActivityLogs] = useState<any[]>([]);const [activityLoading, setActivityLoading] = useState(false);// 🔴 متغيرات الأرصدة للمستخدم الحاليconst [myBalances, setMyBalances] = useState({leavesLeft: MONTHLY_LEAVE_DAYS,timeOffLeft: MONTHLY_TIME_OFF_HOURS,});useEffect(() => { fetchData(); }, [role]);const fetchData = async () => {const { data: lr } = await supabase.from("leave_requests").select("*").order("created_at", { ascending: false });const requests = lr ?? [];setLeaveRequests(requests);// 🔴 الخوارزمية الذكية لحساب رصيد المستخدم الحالي للشهر الحالي
if (user) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let usedLeaveDays = 0;
  let usedTimeOffHours = 0;

  requests.forEach((req: any) => {
    // حساب فقط الطلبات الخاصة بي في هذا الشهر والتي لم يتم رفضها نهائياً
    if (req.user_id === user.id && req.admin_decision !== "admin_rejected") {
      const reqDate = new Date(req.start_date);
      if (reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear) {
        
        if (req.leave_type === "leave" && req.end_date) {
          // حساب عدد الأيام (نهاية - بداية + 1)
          const start = new Date(req.start_date);
          const end = new Date(req.end_date);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          usedLeaveDays += diffDays;
        } 
        else if (req.leave_type === "time_off" && req.hours) {
          usedTimeOffHours += parseFloat(req.hours);
        }
      }
    }
  });

  setMyBalances({
    leavesLeft: Math.max(0, MONTHLY_LEAVE_DAYS - usedLeaveDays),
    timeOffLeft: Math.max(0, MONTHLY_TIME_OFF_HOURS - usedTimeOffHours),
  });
}

const todayStr = new Date().toISOString().slice(0, 10);
const { data: att } = await supabase.from("attendance").select("*").eq("date", todayStr);
setAttendance(att ?? []);

if (role === "admin" || role === "unit_head") {
  const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, duty_system, unit");
  setMembers(profiles ?? []);
  setAllUsers(profiles ?? []);
}
setLoading(false);
};const openRequestDialog = (type: string) => {setRequestType(type);// تصفير النموذج عند الفتحsetForm({ leave_type: type === "leave" || type === "time_off" || type === "exit" ? type : "leave", start_date: "", end_date: "", hours: "", reason: "" });// إذا كان نوع الطلب إجازة وتاريخ البداية فارغاً، نضع تاريخ اليوم كقيمة مبدئية
if (type === "leave") {
  const today = new Date().toISOString().slice(0, 10);
  setForm(prev => ({ ...prev, start_date: today, end_date: today }));
}

setDialogOpen(true);
};const handleLeaveRequest = async (e: React.FormEvent) => {e.preventDefault();// 🔴 التدقيق الإضافي قبل الإرسال (حماية إضافية)
if (requestType === "leave") {
  const start = new Date(form.start_date);
  const end = new Date(form.end_date);
  if (end < start) {
    toast({ title: "خطأ", description: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية", variant: "destructive" });
    return;
  }
  const requestedDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (requestedDays > myBalances.leavesLeft) {
    toast({ title: "عذراً", description: `رصيدك المتبقي (${myBalances.leavesLeft} أيام) لا يكفي لطلب ${requestedDays} أيام`, variant: "destructive" });
    return;
  }
} else if (requestType === "time_off") {
  if (parseFloat(form.hours) > myBalances.timeOffLeft) {
    toast({ title: "عذراً", description: `رصيدك المتبقي (${myBalances.timeOffLeft} ساعات) لا يكفي`, variant: "destructive" });
    return;
  }
}

const body: any = {
  user_id: user!.id,
  leave_type: (requestType === "leave" || requestType === "time_off") ? requestType : "leave",
  start_date: form.start_date,
  reason: (requestType === "task_request" || requestType === "personal" || requestType === "exit")
    ? `[${requestTypeLabels[requestType]}] ${form.reason}`
    : form.reason,
};
if (requestType === "leave") body.end_date = form.end_date;
if (requestType === "time_off") body.hours = parseFloat(form.hours);

const { error } = await supabase.from("leave_requests").insert(body);
if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
else {
  toast({ title: "تم تقديم الطلب بنجاح" });
  setDialogOpen(false);
  setForm({ leave_type: "leave", start_date: "", end_date: "", hours: "", reason: "" });
  fetchData(); // لجلب البيانات وتحديث الرصيد فوراً
}
};const fetchApplicantInfo = async (lr: any) => {setSelectedRequest(lr);// 🔴 حساب الرصيد للمستخدم المتقدم بالطلب (للمدير)const today = new Date();const currentMonth = today.getMonth();const currentYear = today.getFullYear();let usedLeaveDays = 0;
let usedTimeOffHours = 0;
const monthRequests: any[] = [];

leaveRequests.forEach((req: any) => {
  if (req.user_id === lr.user_id && req.admin_decision !== "admin_rejected") {
    const reqDate = new Date(req.start_date);
    if (reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear) {
      if (req.id !== lr.id) monthRequests.push(req); // حفظ الطلبات الأخرى للعرض
      
      if (req.leave_type === "leave" && req.end_date) {
        const start = new Date(req.start_date);
        const end = new Date(req.end_date);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        usedLeaveDays += diffDays;
      } 
      else if (req.leave_type === "time_off" && req.hours) {
        usedTimeOffHours += parseFloat(req.hours);
      }
    }
  }
});

const member = members.find(m => m.user_id === lr.user_id);
setApplicantInfo({ 
  name: member?.full_name ?? "—", 
  leavesLeft: Math.max(0, MONTHLY_LEAVE_DAYS - usedLeaveDays),
  timeOffLeft: Math.max(0, MONTHLY_TIME_OFF_HOURS - usedTimeOffHours),
  monthRequests 
});
setInfoDialogOpen(true);
};const handleApproval = async (id: string, decision: string) => {const updates: any = {};if (role === "unit_head") {updates.unit_head_decision = decision; updates.unit_head_id = user!.id;updates.unit_head_date = new Date().toISOString(); updates.status = decision;} else if (role === "admin") {updates.admin_decision = decision; updates.admin_id = user!.id;updates.admin_date = new Date().toISOString(); updates.status = decision;}const { error } = await supabase.from("leave_requests").update(updates).eq("id", id);if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });else { toast({ title: "تم تحديث الطلب" }); setInfoDialogOpen(false); fetchData(); }};const handleUndo = async (id: string) => {const updates: any = { status: "pending" as any };if (role === "unit_head") {updates.unit_head_decision = null; updates.unit_head_id = null; updates.unit_head_date = null; updates.unit_head_notes = null;} else if (role === "admin") {updates.admin_decision = null; updates.admin_id = null; updates.admin_date = null; updates.admin_notes = null;}const { error } = await supabase.from("leave_requests").update(updates).eq("id", id);if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });else { toast({ title: "تم التراجع عن القرار" }); setInfoDialogOpen(false); fetchData(); }};const handleAttendance = async (e: React.FormEvent) => {e.preventDefault();const { error } = await supabase.from("attendance").upsert({user_id: attForm.user_id, date: new Date().toISOString().slice(0, 10),status: attForm.status as any, notes: attForm.notes,}, { onConflict: "user_id,date" });if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });else { toast({ title: "تم تسجيل الحضور" }); setAttendanceDialog(false); fetchData(); }};const isDecisionMade = (lr: any) => {if (role === "unit_head") return lr.unit_head_decision && lr.unit_head_decision !== "pending";if (role === "admin") return lr.admin_decision && lr.admin_decision !== "pending";return false;};const filteredUsers = usersFilterUnit === "all" ? allUsers : allUsers.filter(u => u.unit === usersFilterUnit);const fetchActivityLogs = async () => {setActivityLoading(true);const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100);setActivityLogs(data ?? []);setActivityLoading(false);};const actionLabels: Record<string, string> = {update_curriculum: "تعديل منهاج", create_user: "إنشاء مستخدم",disable_user: "تعطيل حساب", enable_user: "تفعيل حساب",reset_password: "إعادة تعيين كلمة مرور", update_profile: "تعديل بيانات",};const getUserName = (userId: string | null) => {if (!userId) return "—";return members.find(p => p.user_id === userId)?.full_name ?? "مستخدم";};const getRequestLabel = (lr: any) => {if (lr.reason?.startsWith("[")) {const match = lr.reason.match(/^$$([^$$]+)]/);if (match) return match[1];}return lr.leave_type === "leave" ? "إجازة اعتيادية" : "زمنية";};const filteredRequests = leaveRequests.filter(lr => {if (!search) return true;const label = getRequestLabel(lr);return label.includes(search) || lr.reason?.includes(search) || lr.start_date?.includes(search);});// Request dialog contentconst renderRequestForm = () => {// التحقق من الرصيد وعرض رسالة التحذيرconst isOutOfLeaves = requestType === "leave" && myBalances.leavesLeft <= 0;const isOutOfTimeOff = requestType === "time_off" && myBalances.timeOffLeft <= 0;return (
  <form onSubmit={handleLeaveRequest} className="space-y-4">
    <div className="flex justify-between items-center p-3 bg-primary/10 border border-primary/20 rounded-lg">
      <div className="flex items-center gap-2">
        {requestType in requestTypeIcons && (() => {
          const Icon = requestTypeIcons[requestType];
          return <Icon className="w-4 h-4 text-primary" />;
        })()}
        <span className="text-sm font-medium text-primary">{requestTypeLabels[requestType]}</span>
      </div>
      
      {/* عرض الرصيد للمستخدم */}
      {requestType === "leave" && (
        <Badge variant="outline" className={isOutOfLeaves ? "text-destructive border-destructive" : "text-primary border-primary"}>
          المتبقي: {myBalances.leavesLeft} أيام
        </Badge>
      )}
      {requestType === "time_off" && (
        <Badge variant="outline" className={isOutOfTimeOff ? "text-destructive border-destructive" : "text-primary border-primary"}>
          المتبقي: {myBalances.timeOffLeft} ساعات
        </Badge>
      )}
    </div>

    {/* رسالة التحذير في حال نفاد الرصيد */}
    {(isOutOfLeaves || isOutOfTimeOff) ? (
      <div className="flex flex-col items-center justify-center py-6 text-destructive text-center space-y-2 bg-destructive/5 rounded-lg border border-destructive/20">
        <AlertCircle className="w-8 h-8 opacity-80" />
        <p className="font-bold">لقد استنفدت رصيدك المسموح به لهذا الشهر</p>
        <p className="text-xs opacity-80">يتم تجديد الرصيد تلقائياً بداية كل شهر ميلادي.</p>
      </div>
    ) : (
      <>
        <div className="space-y-2">
          <Label>التاريخ</Label>
          <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
        </div>

        {requestType === "leave" && (
          <div className="space-y-2">
            <Label>تاريخ النهاية</Label>
            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
          </div>
        )}

        {requestType === "time_off" && (
          <div className="space-y-2">
            <Label>عدد الساعات</Label>
            <Input type="number" step="0.5" min="0.5" max={myBalances.timeOffLeft} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required />
          </div>
        )}

        <div className="space-y-2">
          <Label>السبب {(requestType === "task_request" || requestType === "personal") ? "*" : "(اختياري)"}</Label>
          <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder={requestType === "task_request" ? "اشرح تفاصيل المهمة المطلوبة..." : requestType === "personal" ? "اشرح طلبك..." : "اختياري"}
            required={requestType === "task_request" || requestType === "personal"}
          />
        </div>

        <Button type="submit" className="w-full gradient-primary text-white">تقديم الطلب</Button>
      </>
    )}
  </form>
);
};return (<AppLayout><div className="space-y-4 p-2 sm:p-4">{/* Header */}<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"><div><h2 className="text-lg sm:text-xl font-bold font-cairo flex items-center gap-2"><CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />الموارد البشرية</h2><p className="text-xs sm:text-sm text-muted-foreground">الحضور والطلبات ودورة الموافقة</p></div><div className="flex gap-2 w-full sm:w-auto flex-wrap">{(role === "admin" || role === "unit_head") && (<Dialog open={attendanceDialog} onOpenChange={setAttendanceDialog}><DialogTrigger asChild><Button variant="outline" className="gap-1 text-xs sm:text-sm flex-1 sm:flex-none"><Clock className="w-4 h-4" />تسجيل حضور</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle className="font-cairo">تسجيل الحضور اليومي</DialogTitle></DialogHeader><form onSubmit={handleAttendance} className="space-y-4"><div className="space-y-2"><Label>العضو</Label><Select value={attForm.user_id} onValueChange={(v) => setAttForm({ ...attForm, user_id: v })}><SelectTrigger><SelectValue placeholder="اختر العضو" /></SelectTrigger><SelectContent>{members.map((m) => (<SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>))}</SelectContent></Select></div><div className="space-y-2"><Label>الحالة</Label><Select value={attForm.status} onValueChange={(v) => setAttForm({ ...attForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="present">حاضر</SelectItem><SelectItem value="leave">مجاز</SelectItem><SelectItem value="time_off">زمنية</SelectItem><SelectItem value="duty">واجب</SelectItem><SelectItem value="absent">غائب</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>ملاحظات</Label><Textarea value={attForm.notes} onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })} /></div><Button type="submit" className="w-full gradient-primary text-white">تسجيل</Button></form></DialogContent></Dialog>)}        {/* "طلب جديد" dropdown for individuals; single button for admins */}
        {role === "individual" ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gradient-primary text-white gap-2 flex-1 sm:flex-none">
                  <Plus className="w-4 h-4" />طلب جديد
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border border-border shadow-elevated z-50">
                {Object.entries(requestTypeLabels).map(([type, label]) => {
                  const Icon = requestTypeIcons[type];
                  return (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => openRequestDialog(type)}
                      className="gap-2 cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      {label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-md mx-4 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle className="font-cairo">طلب جديد</DialogTitle>
                </DialogHeader>
                {renderRequestForm()}
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-white gap-2 flex-1 sm:flex-none" onClick={() => openRequestDialog("leave")}>
                <Plus className="w-4 h-4" />طلب إجازة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md mx-4 sm:mx-auto">
              <DialogHeader><DialogTitle className="font-cairo">طلب إجازة / زمنية</DialogTitle></DialogHeader>
              {renderRequestForm()}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>

    <Tabs defaultValue="requests" className="w-full">
      <TabsList className="w-full sm:w-auto overflow-x-auto flex-nowrap">
        <TabsTrigger value="requests" className="text-xs sm:text-sm">الطلبات</TabsTrigger>
        <TabsTrigger value="attendance" className="text-xs sm:text-sm">الحضور</TabsTrigger>
        {(role === "admin" || role === "unit_head") && (
          <>
            <TabsTrigger value="users" className="gap-1 text-xs sm:text-sm">
              <Users className="w-3.5 h-3.5" /><span className="hidden sm:inline">عرض</span> المستخدمين
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1 text-xs sm:text-sm" onClick={() => { if (activityLogs.length === 0) fetchActivityLogs(); }}>
              <Activity className="w-3.5 h-3.5" /><span className="hidden sm:inline">سجل</span> النشاط
            </TabsTrigger>
          </>
        )}
      </TabsList>

      <TabsContent value="requests">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="ابحث في الطلبات..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isMobile ? (
          <div className="space-y-3">
            {filteredRequests.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">لا توجد طلبات</p>
            ) : filteredRequests.map((lr) => (
              <Card key={lr.id} className="shadow-card border-0">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{getRequestLabel(lr)}</span>
                    <Badge className={`text-xs ${statusColors[lr.status] ?? ""}`}>{statusLabels[lr.status] ?? lr.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lr.start_date}{lr.end_date ? ` ← ${lr.end_date}` : ""}
                    {lr.hours ? ` (${lr.hours} ساعة)` : ""}
                  </p>
                  {lr.reason && <p className="text-xs text-muted-foreground line-clamp-2">{lr.reason}</p>}
                  {(role === "admin" || role === "unit_head") && (
                    <div className="flex gap-2 pt-1">
                      {(lr.status === "pending" || (role === "admin" && lr.status === "unit_head_approved")) && (
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-info border-info/30" onClick={() => fetchApplicantInfo(lr)}>
                          <User className="w-3 h-3 ml-1" />مراجعة
                        </Button>
                      )}
                      {isDecisionMade(lr) && (
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-warning border-warning/30" onClick={() => handleUndo(lr.id)}>
                          <Undo2 className="w-3 h-3 ml-1" />تراجع
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="shadow-card border-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">نوع الطلب</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">مسؤول الشعبة</TableHead>
                      <TableHead className="text-right">المدير</TableHead>
                      {(role === "admin" || role === "unit_head") && <TableHead className="text-right">إجراء</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد طلبات</TableCell></TableRow>
                    ) : filteredRequests.map((lr) => (
                      <TableRow key={lr.id}>
                        <TableCell className="font-medium">{getRequestLabel(lr)}</TableCell>
                        <TableCell className="text-sm">{lr.start_date}{lr.end_date ? ` → ${lr.end_date}` : ""}{lr.hours ? ` (${lr.hours}س)` : ""}</TableCell>
                        <TableCell><Badge className={`text-xs ${statusColors[lr.status] ?? ""}`}>{statusLabels[lr.status] ?? lr.status}</Badge></TableCell>
                        <TableCell className="text-xs">{statusLabels[lr.unit_head_decision] ?? "—"}</TableCell>
                        <TableCell className="text-xs">{statusLabels[lr.admin_decision] ?? "—"}</TableCell>
                        {(role === "admin" || role === "unit_head") && (
                          <TableCell>
                            <div className="flex gap-1">
                              {(lr.status === "pending" || (role === "admin" && lr.status === "unit_head_approved")) && (
                                <Button size="sm" variant="ghost" className="text-info h-7 gap-1 text-xs" onClick={() => fetchApplicantInfo(lr)}>
                                  <User className="w-3 h-3" />مراجعة
                                </Button>
                              )}
                              {isDecisionMade(lr) && (
                                <Button size="sm" variant="ghost" className="text-warning h-7 gap-1 text-xs" onClick={() => handleUndo(lr.id)}>
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
        )}
      </TabsContent>

      <TabsContent value="attendance">
        <Card className="shadow-card border-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
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
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">لا سجلات لليوم</TableCell></TableRow>
                  ) : attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.date}</TableCell>
                      <TableCell>
                        <Badge className={
                          a.status === "present" ? "bg-success/10 text-success border border-success/30" :
                          a.status === "absent" ? "bg-destructive/10 text-destructive border border-destructive/30" :
                          "bg-warning/10 text-warning border border-warning/30"
                        }>
                          {a.status === "present" ? "حاضر" : a.status === "leave" ? "مجاز" : a.status === "time_off" ? "زمنية" : a.status === "duty" ? "واجب" : "غائب"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {(role === "admin" || role === "unit_head") && (
        <>
          <TabsContent value="users">
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {["all", "preparation", "curriculum"].map((u) => (
                  <button
                    key={u}
                    onClick={() => setUsersFilterUnit(u)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-all ${usersFilterUnit === u ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/40"}`}
                  >
                    {u === "all" ? "الكل" : unitLabels[u]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredUsers.map((u: any) => (
                  <Card key={u.user_id} className="shadow-card border-0 cursor-pointer hover:shadow-elevated transition-all"
                    onClick={() => { setDossierUser({ userId: u.user_id, fullName: u.full_name }); setDossierOpen(true); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {u.full_name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">{unitLabels[u.unit] ?? "—"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <UserDossier open={dossierOpen} onOpenChange={setDossierOpen} userId={dossierUser.userId} fullName={dossierUser.fullName} />
          </TabsContent>

          <TabsContent value="activity">
            {activityLoading ? (
              <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>
            ) : (
              <Card className="shadow-card border-0">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">الإجراء</TableHead>
                          <TableHead className="text-right">المستخدم</TableHead>
                          <TableHead className="text-right">الوقت</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activityLogs.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">لا سجلات</TableCell></TableRow>
                        ) : activityLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium text-sm">{actionLabels[log.action] ?? log.action}</TableCell>
                            <TableCell className="text-sm">{getUserName(log.user_id)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("ar-SA")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </>
      )}
    </Tabs>

    {/* Applicant Info Dialog */}
    <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
      <DialogContent className="max-w-md mx-4 sm:mx-auto">
        <DialogHeader><DialogTitle className="font-cairo">مراجعة الطلب</DialogTitle></DialogHeader>
        {applicantInfo && selectedRequest && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-bold">{applicantInfo.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                نوع الطلب: {getRequestLabel(selectedRequest)}
              </p>
              {selectedRequest.reason && <p className="text-xs text-muted-foreground">السبب: {selectedRequest.reason}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-primary/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">رصيد الإجازات المتبقي</p>
                <p className="text-lg font-bold text-primary">
                  {applicantInfo.leavesLeft} يوم
                </p>
              </div>
              <div className="p-3 bg-info/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">رصيد الزمنيات المتبقي</p>
                <p className="text-lg font-bold text-info">
                  {applicantInfo.timeOffLeft} ساعة
                </p>
              </div>
            </div>

            {applicantInfo.monthRequests.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">طلبات أخرى هذا الشهر:</p>
                <div className="space-y-1">
                  {applicantInfo.monthRequests.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                      <span>{getRequestLabel(r)} — {r.start_date}</span>
                      <Badge className={`text-xs ${statusColors[r.status] ?? ""}`}>{statusLabels[r.status]}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button className="flex-1 gap-1 bg-success hover:bg-success/90 text-white"
                onClick={() => handleApproval(selectedRequest.id, role === "unit_head" ? "unit_head_approved" : "admin_approved")}>
                <CheckCircle className="w-4 h-4" />موافقة
              </Button>
              <Button variant="outline" className="flex-1 gap-1 text-destructive border-destructive/30"
                onClick={() => handleApproval(selectedRequest.id, role === "unit_head" ? "unit_head_rejected" : "admin_rejected")}>
                <XCircle className="w-4 h-4" />رفض
              </Button>
              <Button variant="outline" className="gap-1 text-warning border-warning/30" onClick={() => handleUndo(selectedRequest.id)}>
                <Undo2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  </div>
</AppLayout>
);}
