import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays, Clock, CheckCircle, XCircle, Undo2, Plus, User,
  Users, Activity, ChevronDown, Timer, LogOut, ClipboardList, HeartHandshake, Search, X, AlertCircle
} from "lucide-react";
import UserDossier from "@/components/hr/UserDossier";
import { useIsMobile } from "@/hooks/use-mobile";

const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة", 
  unit_head_approved: "موافقة (مسؤول الشعبة)", 
  unit_head_rejected: "مرفوض (مسؤول الشعبة)",
  admin_approved: "موافقة نهائية (المدير)", 
  admin_rejected: "رفض نهائي (المدير)",
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border border-warning/30",
  unit_head_approved: "bg-info/10 text-info border border-info/30",
  unit_head_rejected: "bg-destructive/10 text-destructive border border-destructive/30",
  admin_approved: "bg-success/10 text-success border border-success/30",
  admin_rejected: "bg-destructive/10 text-destructive border border-destructive/30",
};

const unitLabels: Record<string, string> = { preparation: "شعبة الإعداد", curriculum: "شعبة المناهج" };

const requestTypeLabels: Record<string, string> = {
  leave: "إجازة اعتيادية",
  time_off: "إجازة زمنية",
  exit: "خروجية",
  task_request: "طلب مهمة",
  personal: "طلب شخصي",
};

const requestTypeIcons: Record<string, typeof CalendarDays> = {
  leave: CalendarDays, time_off: Timer, exit: LogOut,
  task_request: ClipboardList, personal: HeartHandshake,
};

// الثوابت الشهرية المحددة في طلبك
const MONTHLY_LEAVE_DAYS = 3;
const MONTHLY_TIME_OFF_HOURS = 7;

export default function HRPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestType, setRequestType] = useState("leave");
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  
  const [form, setForm] = useState({ 
    target_user_id: "", 
    start_date: "", 
    end_date: "", 
    hours: "", 
    time_off_period: "morning",
    exit_time: "", 
    reason: "" 
  });
  
  const [attForm, setAttForm] = useState({ user_id: "", status: "present", notes: "" });
  
  const [applicantInfo, setApplicantInfo] = useState<any>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [search, setSearch] = useState("");
  
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersFilterUnit, setUsersFilterUnit] = useState("all");
  const [dossierOpen, setDossierOpen] = useState(false);
  const [dossierUser, setDossierUser] = useState<{ userId: string; fullName: string }>({ userId: "", fullName: "" });
  
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [targetBalances, setTargetBalances] = useState({ leavesLeft: MONTHLY_LEAVE_DAYS, timeOffLeft: MONTHLY_TIME_OFF_HOURS });
  const [historyFilter, setHistoryFilter] = useState<"same_type" | "all">("same_type");

  useEffect(() => { fetchData(); }, [role]);

  const fetchData = async () => {
    setLoading(true);
    
    // الطريقة المضمونة لجلب المستخدمين (منفصلة لمنع أخطاء الـ DB)
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, duty_system, unit");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    
    const roleMap: Record<string, string> = {};
    (roles ?? []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
    
    const mergedProfiles = (profiles ?? []).map((p: any) => ({
      ...p,
      role: roleMap[p.user_id] ?? "individual",
    }));
    
    setMembers(mergedProfiles);
    setAllUsers(mergedProfiles);

    // جلب الطلبات
    const { data: lr } = await supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
    setLeaveRequests(lr ?? []);

    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: att } = await supabase.from("attendance").select("*").eq("date", todayStr);
    setAttendance(att ?? []);

    if (user && roleMap[user.id] === "individual") {
      setForm(prev => ({ ...prev, target_user_id: user.id }));
    }
    
    setLoading(false);
  };

  // 🔴 الحساس الذكي (تم برمجته بطريقة تمنع اللوب والشاشة البيضاء تماماً)
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current || leaveRequests.length === 0 || members.length === 0) return;
    
    const leaveId = searchParams.get("leaveId");
    if (leaveId) {
      openedFromUrl.current = true;
      const reqToOpen = leaveRequests.find(r => String(r.id) === leaveId);
      if (reqToOpen) {
        // نستخدم setTimeout لضمان اكتمال تحميل الصفحة قبل فتح المودال
        setTimeout(() => {
          fetchApplicantInfo(reqToOpen);
          setSearchParams({}, { replace: true });
        }, 100);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveRequests, members]); // يعتمد فقط على اكتمال جلب البيانات

  // تحديث الأرصدة للموظف المختار بالنموذج
  useEffect(() => {
    if (form.target_user_id && leaveRequests.length > 0) {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      let usedLeaveDays = 0;
      let usedTimeOffHours = 0;

      leaveRequests.forEach((req: any) => {
        if (req.user_id === form.target_user_id && req.admin_decision !== "admin_rejected") {
          const reqDate = new Date(req.start_date);
          if (reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear) {
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

      setTargetBalances({
        leavesLeft: Math.max(0, MONTHLY_LEAVE_DAYS - usedLeaveDays),
        timeOffLeft: Math.max(0, MONTHLY_TIME_OFF_HOURS - usedTimeOffHours),
      });
    }
  }, [form.target_user_id, leaveRequests]);

  const openRequestDialog = (type: string) => {
    setRequestType(type);
    let initialTarget = "";
    if (role === "individual") initialTarget = user!.id;
    
    setForm({ 
      target_user_id: initialTarget, 
      start_date: new Date().toISOString().slice(0, 10), 
      end_date: new Date().toISOString().slice(0, 10), 
      hours: "", 
      time_off_period: "morning",
      exit_time: "",
      reason: "" 
    });
    setDialogOpen(true);
  };

  const handleLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.target_user_id) {
      toast({ title: "خطأ", description: "يرجى اختيار الموظف أولاً", variant: "destructive" });
      return;
    }

    if (requestType === "leave") {
      const start = new Date(form.start_date);
      const end = new Date(form.end_date);
      if (end < start) {
        toast({ title: "خطأ", description: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية", variant: "destructive" });
        return;
      }
      const requestedDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (requestedDays > targetBalances.leavesLeft) {
        toast({ title: "عذراً", description: `الرصيد المتبقي (${targetBalances.leavesLeft} أيام) لا يكفي لطلب ${requestedDays} أيام`, variant: "destructive" });
        return;
      }
    } else if (requestType === "time_off") {
      if (parseFloat(form.hours) > targetBalances.timeOffLeft) {
        toast({ title: "عذراً", description: `الرصيد المتبقي (${targetBalances.timeOffLeft} ساعات) لا يكفي`, variant: "destructive" });
        return;
      }
    }

    let finalReason = form.reason;
    if (requestType === "time_off") {
      finalReason = `[الفترة: ${form.time_off_period === 'morning' ? 'بداية الدوام' : 'نهاية الدوام'}] ` + form.reason;
    } else if (requestType === "exit") {
      finalReason = `[ساعة الخروج: ${form.exit_time}] [المدة: ${form.hours} ساعة] ` + form.reason;
    } else if (requestType === "task_request" || requestType === "personal") {
      finalReason = `[${requestTypeLabels[requestType]}] ` + form.reason;
    }

    const body: any = {
      user_id: form.target_user_id,
      leave_type: requestType,
      start_date: form.start_date,
      reason: finalReason,
    };
    
    if (requestType === "leave") body.end_date = form.end_date;
    if (requestType === "time_off" || requestType === "exit") body.hours = parseFloat(form.hours);

    const { error } = await supabase.from("leave_requests").insert(body);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      toast({ title: "تم تقديم الطلب بنجاح" });
      setDialogOpen(false);
      fetchData();
    }
  };

  const fetchApplicantInfo = (lr: any) => {
    setSelectedRequest(lr);
    setHistoryFilter("same_type"); 

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    let usedLeaveDays = 0;
    let usedTimeOffHours = 0;
    const monthRequests: any[] = [];

    leaveRequests.forEach((req: any) => {
      if (req.user_id === lr.user_id && req.admin_decision !== "admin_rejected") {
        const reqDate = new Date(req.start_date);
        if (reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear) {
          if (req.id !== lr.id) monthRequests.push(req);
          
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
      name: member?.full_name ?? "مستخدم غير معروف", 
      leavesLeft: Math.max(0, MONTHLY_LEAVE_DAYS - usedLeaveDays),
      timeOffLeft: Math.max(0, MONTHLY_TIME_OFF_HOURS - usedTimeOffHours),
      monthRequests 
    });
    setInfoDialogOpen(true);
  };

  const handleApproval = async (id: string, decision: string) => {
    const updates: any = {};
    if (role === "unit_head") {
      updates.unit_head_decision = decision; 
      updates.status = decision;
    } else if (role === "admin") {
      updates.admin_decision = decision; 
      updates.status = decision;
    }
    
    const { error } = await supabase.from("leave_requests").update(updates).eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم تحديث الطلب" }); setInfoDialogOpen(false); fetchData(); }
  };

  const handleUndo = async (id: string) => {
    const updates: any = { status: "pending" };
    if (role === "unit_head") {
      updates.unit_head_decision = null;
    } else if (role === "admin") {
      updates.admin_decision = null;
      if (selectedRequest.unit_head_decision) {
        updates.status = selectedRequest.unit_head_decision;
      }
    }
    const { error } = await supabase.from("leave_requests").update(updates).eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم التراجع عن القرار" }); setInfoDialogOpen(false); fetchData(); }
  };

  // 🔴 هندسة الصلاحيات الدقيقة لقائمة التقديم
  const requestTargetUsers = members.filter(m => {
    if (role === 'admin') return m.role !== 'admin'; // المدير لا يطلب لنفسه، يطلب للكل
    if (role === 'unit_head') {
      const myUnit = members.find(x => x.user_id === user?.id)?.unit;
      return m.user_id === user?.id || m.unit === myUnit; // مسؤول الشعبة لنفسه ولأفراده
    }
    return m.user_id === user?.id; // الفرد لنفسه فقط
  });

  const getRequestLabel = (lr: any) => {
    return requestTypeLabels[lr.leave_type] ?? lr.leave_type;
  };

  // حماية البيانات: الأفراد يرون طلباتهم فقط
  const filteredRequests = leaveRequests.filter(lr => {
    if (role === "individual" && lr.user_id !== user?.id) return false;
    if (role === "unit_head") {
      const isMine = lr.user_id === user?.id;
      const myUnit = members.find(m => m.user_id === user?.id)?.unit;
      const reqUnit = members.find(m => m.user_id === lr.user_id)?.unit;
      if (!isMine && myUnit !== reqUnit) return false;
    }

    if (!search) return true;
    const label = getRequestLabel(lr);
    return label.includes(search) || lr.reason?.includes(search) || lr.start_date?.includes(search);
  });

  const fetchActivityLogs = async () => {
    setActivityLoading(true);
    const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100);
    setActivityLogs(data ?? []);
    setActivityLoading(false);
  };

  const actionLabels: Record<string, string> = {
    update_curriculum: "تعديل منهاج", create_user: "إنشاء مستخدم",
    disable_user: "تعطيل حساب", enable_user: "تفعيل حساب",
    reset_password: "إعادة تعيين كلمة مرور", update_profile: "تعديل بيانات",
  };

  const renderRequestForm = () => {
    const isOutOfLeaves = requestType === "leave" && targetBalances.leavesLeft <= 0;
    const isOutOfTimeOff = requestType === "time_off" && targetBalances.timeOffLeft <= 0;

    return (
      <form onSubmit={handleLeaveRequest} className="space-y-4">
        <div className="flex justify-between items-center p-3 bg-primary/10 border border-primary/20 rounded-lg mb-2">
          <div className="flex items-center gap-2">
            {requestType in requestTypeIcons && (() => {
              const Icon = requestTypeIcons[requestType];
              return <Icon className="w-4 h-4 text-primary" />;
            })()}
            <span className="text-sm font-medium text-primary">{requestTypeLabels[requestType]}</span>
          </div>
          
          {requestType === "leave" && (
            <Badge variant="outline" className={isOutOfLeaves ? "text-destructive border-destructive" : "text-primary border-primary"}>
              الرصيد المتبقي: {targetBalances.leavesLeft} أيام
            </Badge>
          )}
          {requestType === "time_off" && (
            <Badge variant="outline" className={isOutOfTimeOff ? "text-destructive border-destructive" : "text-primary border-primary"}>
              الرصيد المتبقي: {targetBalances.timeOffLeft} ساعات
            </Badge>
          )}
        </div>

        {(role === "admin" || role === "unit_head") && (
          <div className="space-y-2 border-b pb-4">
            <Label className="text-primary font-bold">تقديم الطلب نيابة عن:</Label>
            <Select value={form.target_user_id} onValueChange={(v) => setForm({ ...form, target_user_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
              <SelectContent>
                {requestTargetUsers.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.user_id === user?.id ? "أنا (طلبي الشخصي)" : m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(!form.target_user_id && role !== "individual") ? (
          <p className="text-center text-sm text-muted-foreground py-4">يرجى اختيار الموظف لعرض أرصدته وإكمال الطلب.</p>
        ) : (isOutOfLeaves || isOutOfTimeOff) ? (
          <div className="flex flex-col items-center justify-center py-6 text-destructive text-center space-y-2 bg-destructive/5 rounded-lg border border-destructive/20 mt-4">
            <AlertCircle className="w-8 h-8 opacity-80" />
            <p className="font-bold">نفد الرصيد المسموح به لهذا الشهر</p>
            <p className="text-xs opacity-80">يتم تجديد الأرصدة تلقائياً بداية كل شهر.</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>تاريخ الطلب</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
            </div>

            {requestType === "leave" && (
              <div className="space-y-2">
                <Label>تاريخ النهاية</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
              </div>
            )}

            {requestType === "time_off" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>وقت الزمنية</Label>
                  <Select value={form.time_off_period} onValueChange={(v) => setForm({ ...form, time_off_period: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">في بداية الدوام</SelectItem>
                      <SelectItem value="end">في نهاية الدوام</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المدة (ساعات)</Label>
                  <Input type="number" step="0.5" min="0.5" max={targetBalances.timeOffLeft} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required />
                </div>
              </div>
            )}

            {requestType === "exit" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>ساعة الخروج المقترحة</Label>
                  <Input type="time" value={form.exit_time} onChange={(e) => setForm({ ...form, exit_time: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>المدة المطلوبة (ساعات)</Label>
                  <Input type="number" step="0.5" min="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>السبب / التفاصيل {(requestType !== "leave") ? "*" : "(اختياري)"}</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder={requestType === "task_request" ? "تفاصيل المهمة المطلوبة..." : requestType === "personal" ? "اشرح طلبك..." : "اكتب السبب هنا..."}
                required={requestType !== "leave"}
              />
            </div>

            <Button type="submit" className="w-full gradient-primary text-white mt-4">تأكيد وتقديم الطلب</Button>
          </div>
        )}
      </form>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-4 p-2 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-cairo flex items-center gap-2">
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />الموارد البشرية
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">الحضور والطلبات ودورة الموافقة</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gradient-primary text-white gap-2 flex-1 sm:flex-none">
                  <Plus className="w-4 h-4" />{role === "admin" ? "إنشاء طلب للموظفين" : "طلب جديد"}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border border-border shadow-elevated z-50">
                {Object.entries(requestTypeLabels).map(([type, label]) => {
                  const Icon = requestTypeIcons[type];
                  return (
                    <DropdownMenuItem key={type} onClick={() => openRequestDialog(type)} className="gap-2 cursor-pointer">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      {label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-cairo">تقديم طلب</DialogTitle></DialogHeader>
                {renderRequestForm()}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="w-full sm:w-auto overflow-x-auto flex-nowrap">
            <TabsTrigger value="requests" className="text-xs sm:text-sm">الطلبات</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs sm:text-sm">الحضور</TabsTrigger>
            {(role === "admin" || role === "unit_head") && (
              <TabsTrigger value="users" className="gap-1 text-xs sm:text-sm">
                <Users className="w-3.5 h-3.5" /><span className="hidden sm:inline">عرض</span> المستخدمين
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="requests">
            <div className="relative mb-3">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ابحث في الطلبات..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
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
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-info border-info/30" onClick={() => fetchApplicantInfo(lr)}>
                          <User className="w-3 h-3 ml-1" />{role === "individual" ? "التفاصيل" : "مراجعة"}
                        </Button>
                      </div>
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
                          <TableHead className="text-right">الموظف</TableHead>
                          <TableHead className="text-right">نوع الطلب</TableHead>
                          <TableHead className="text-right">التاريخ / المدة</TableHead>
                          <TableHead className="text-right">الحالة النهائية</TableHead>
                          <TableHead className="text-right">إجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequests.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد طلبات</TableCell></TableRow>
                        ) : filteredRequests.map((lr) => (
                          <TableRow key={lr.id}>
                            <TableCell className="font-bold text-sm">
                              {members.find(m => m.user_id === lr.user_id)?.full_name || "مستخدم"}
                            </TableCell>
                            <TableCell className="font-medium">{getRequestLabel(lr)}</TableCell>
                            <TableCell className="text-sm">{lr.start_date}{lr.end_date ? ` → ${lr.end_date}` : ""}{lr.hours ? ` (${lr.hours}س)` : ""}</TableCell>
                            <TableCell><Badge className={`text-xs ${statusColors[lr.status] ?? ""}`}>{statusLabels[lr.status] ?? lr.status}</Badge></TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="text-info h-7 gap-1 text-xs" onClick={() => fetchApplicantInfo(lr)}>
                                <User className="w-3 h-3" /> {role === "individual" ? "التفاصيل" : "مراجعة"}
                              </Button>
                            </TableCell>
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
                    <TableHeader><TableRow><TableHead className="text-right">التاريخ</TableHead><TableHead className="text-right">الحالة</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {attendance.map((a) => (
                        <TableRow key={a.id}><TableCell>{a.date}</TableCell><TableCell>{a.status}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {(role === "admin" || role === "unit_head") && (
            <TabsContent value="users">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {allUsers.map((u: any) => (
                  <Card key={u.user_id} className="shadow-card border-0 cursor-pointer" onClick={() => { setDossierUser({ userId: u.user_id, fullName: u.full_name }); setDossierOpen(true); }}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold">{u.full_name?.charAt(0)}</div>
                      <div><p className="font-medium text-sm">{u.full_name}</p></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <UserDossier open={dossierOpen} onOpenChange={setDossierOpen} userId={dossierUser.userId} fullName={dossierUser.fullName} />
            </TabsContent>
          )}
        </Tabs>

        {/* Dialog المراجعة الذكي */}
        <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
          <DialogContent className="max-w-md mx-4 sm:mx-auto max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-cairo">{role === "individual" ? "تفاصيل الطلب" : "مراجعة الطلب"}</DialogTitle></DialogHeader>
            {applicantInfo && selectedRequest && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 border border-border rounded-lg shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-base font-bold text-primary">{applicantInfo.name}</p>
                    <Badge className={`text-[10px] ${statusColors[selectedRequest.status] ?? ""}`}>{statusLabels[selectedRequest.status]}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <p><span className="text-muted-foreground">نوع الطلب:</span> {getRequestLabel(selectedRequest)}</p>
                    <p><span className="text-muted-foreground">التاريخ:</span> {selectedRequest.start_date}</p>
                  </div>
                  {selectedRequest.reason && <p className="text-xs mt-2 bg-white p-2 rounded border whitespace-pre-wrap leading-relaxed">{selectedRequest.reason}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg text-center border border-primary/20">
                    <p className="text-[10px] text-muted-foreground font-bold">إجازات متبقية</p>
                    <p className="text-lg font-black text-primary">{applicantInfo.leavesLeft} <span className="text-xs font-normal">يوم</span></p>
                  </div>
                  <div className="p-3 bg-info/10 rounded-lg text-center border border-info/20">
                    <p className="text-[10px] text-muted-foreground font-bold">زمنيات متبقية</p>
                    <p className="text-lg font-black text-info">{applicantInfo.timeOffLeft} <span className="text-xs font-normal">ساعة</span></p>
                  </div>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-2 bg-muted/50 border-b">
                    <p className="text-xs font-bold text-slate-700">سجل طلبات الموظف لهذا الشهر</p>
                    <div className="flex gap-1 bg-white p-0.5 rounded shadow-sm border">
                      <button onClick={() => setHistoryFilter("same_type")} className={`text-[10px] px-2 py-1 rounded transition-colors ${historyFilter === "same_type" ? "bg-primary text-white font-bold" : "text-muted-foreground hover:bg-slate-50"}`}>نفس النوع</button>
                      <button onClick={() => setHistoryFilter("all")} className={`text-[10px] px-2 py-1 rounded transition-colors ${historyFilter === "all" ? "bg-primary text-white font-bold" : "text-muted-foreground hover:bg-slate-50"}`}>الكل</button>
                    </div>
                  </div>
                  <div className="max-h-32 overflow-y-auto p-2 space-y-1 bg-slate-50/50">
                    {applicantInfo.monthRequests.filter((r: any) => historyFilter === "all" || r.leave_type === selectedRequest.leave_type).length === 0 ? (
                      <p className="text-xs text-center py-4 text-muted-foreground italic">لا توجد سجلات مطابقة</p>
                    ) : (
                      applicantInfo.monthRequests.filter((r: any) => historyFilter === "all" || r.leave_type === selectedRequest.leave_type).map((r: any) => (
                        <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 bg-white rounded border border-slate-100 shadow-sm text-[10px] gap-1">
                          <span className="font-medium text-slate-700">{getRequestLabel(r)} — <span className="text-muted-foreground">{r.start_date}</span></span>
                          <Badge className={`text-[9px] px-1 py-0 h-4 ${statusColors[r.status] ?? ""}`}>{statusLabels[r.status]}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {role !== "individual" && (
                  <div className="flex gap-2 pt-2 border-t mt-4">
                    {(selectedRequest.status === "pending" || (role === "admin" && selectedRequest.status !== "admin_approved")) && (
                      <Button className="flex-1 gap-1 bg-success hover:bg-success/90 text-white" onClick={() => handleApproval(selectedRequest.id, role === "admin" ? "admin_approved" : "unit_head_approved")}>
                        <CheckCircle className="w-4 h-4" /> موافقة
                      </Button>
                    )}
                    
                    {(selectedRequest.status === "pending" || (role === "admin" && selectedRequest.status !== "admin_rejected")) && (
                      <Button variant="outline" className="flex-1 gap-1 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleApproval(selectedRequest.id, role === "admin" ? "admin_rejected" : "unit_head_rejected")}>
                        <XCircle className="w-4 h-4" /> رفض
                      </Button>
                    )}

                    {isDecisionMade(selectedRequest) && (
                      <Button variant="outline" className="gap-1 text-warning border-warning/30 hover:bg-warning/5" onClick={() => handleUndo(selectedRequest.id)}>
                        <Undo2 className="w-4 h-4" /> تراجع
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
