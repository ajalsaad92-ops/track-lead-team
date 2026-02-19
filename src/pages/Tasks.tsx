import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Plus, Search, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  assigned: "مكلّف", in_progress: "قيد التنفيذ", completed: "مكتمل",
  under_review: "قيد المراجعة", approved: "معتمد", suspended: "معلّق",
};
const statusColors: Record<string, string> = {
  assigned: "bg-warning/10 text-warning border-warning/30",
  in_progress: "bg-info/10 text-info border-info/30",
  completed: "bg-primary/10 text-primary border-primary/30",
  under_review: "bg-secondary/10 text-secondary border-secondary/30",
  approved: "bg-success/10 text-success border-success/30",
  suspended: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function TasksPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<any | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [points, setPoints] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState({
    title: "", description: "", task_type: "regular_task", assigned_to: "",
    estimated_hours: "", due_date: "", is_visible_to_unit_head: true
  });

  const [forwardUserId, setForwardUserId] = useState("");

  useEffect(() => {
    fetchTasks();
    fetchMembers();
  }, [role]);

  const fetchTasks = async () => {
    setLoading(true);
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });

    if (role === "individual") {
      query = query.eq("assigned_to", user?.id);
    } else if (role === "unit_head") {
      const { data: profile } = await supabase.from("profiles").select("unit").eq("user_id", user?.id).single();
      query = query.or(`assigned_to.eq.${user?.id},assigned_by.eq.${user?.id},and(unit.eq.${profile?.unit},is_visible_to_unit_head.eq.true)`);
    }

    const { data } = await query;
    setTasks(data ?? []);

    if (role === "individual") {
      const total = (data ?? []).filter(t => t.status === "approved").reduce((s, t) => s + (t.points_awarded || 0), 0);
      setPoints(total);
    }
    setLoading(false);
  };

  const fetchMembers = async () => {
    // جلب الملفات الشخصية مع الأدوار من جدول user_roles
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, unit");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    const roleMap: Record<string, string> = {};
    (roles ?? []).forEach((r: any) => { roleMap[r.user_id] = r.role; });

    const merged = (profiles ?? []).map((p: any) => ({
      ...p,
      role: roleMap[p.user_id] ?? "individual",
    }));
    setMembers(merged);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assigned_to) {
      toast({ title: "يرجى اختيار موظف", variant: "destructive" });
      return;
    }
    const assignedMember = members.find(m => m.user_id === form.assigned_to);

    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description,
      task_type: form.task_type as any,
      assigned_to: form.assigned_to,
      assigned_by: user!.id,
      unit: assignedMember?.unit,
      is_visible_to_unit_head: form.is_visible_to_unit_head,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      due_date: form.due_date || null,
    });

    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      toast({ title: "تم إنشاء المهمة بنجاح" });
      setDialogOpen(false);
      setForm({ title: "", description: "", task_type: "regular_task", assigned_to: "", estimated_hours: "", due_date: "", is_visible_to_unit_head: true });
      fetchTasks();
    }
  };

  const handleForward = async () => {
    if (!forwardUserId || !detailTask) return;
    const { error } = await supabase.from("tasks").update({
      assigned_to: forwardUserId,
      forwarded_from_id: user?.id,
      status: 'assigned'
    }).eq("id", detailTask.id);

    if (error) toast({ title: "خطأ في التحويل", description: error.message, variant: "destructive" });
    else {
      toast({ title: "تم إعادة توجيه المهمة" });
      setForwardDialogOpen(false);
      setDetailDialogOpen(false);
      fetchTasks();
    }
  };

  const updateStatus = async (id: string, status: string, extra?: any) => {
    const { error } = await supabase.from("tasks").update({ status, ...extra }).eq("id", id);
    if (!error) {
      toast({ title: "تم التحديث" });
      fetchTasks();
      setDetailDialogOpen(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchSearch = !search || t.title?.includes(search) || t.description?.includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusFilters = [
    { value: "all", label: "الكل" },
    { value: "assigned", label: "مكلّف" },
    { value: "in_progress", label: "قيد التنفيذ" },
    { value: "under_review", label: "قيد المراجعة" },
    { value: "approved", label: "معتمد" },
  ];

  return (
    <AppLayout>
      <div className="space-y-4 p-2 sm:p-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="text-primary w-5 h-5 sm:w-6 sm:h-6" /> إدارة المهام
            </h1>
            {role === "individual" && <p className="text-success font-bold text-sm">نقاطك: {points}</p>}
          </div>

          {(role === "admin" || role === "unit_head") && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary w-full sm:w-auto">
                  <Plus className="ml-2 h-4 w-4" /> مهمة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className="mx-4 sm:mx-auto max-w-md">
                <DialogHeader><DialogTitle>تكليف بمهمة</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <Input placeholder="عنوان المهمة" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                  <Textarea placeholder="التفاصيل" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

                  <div className="space-y-1">
                    <Label>الموظف المكلَّف</Label>
                    <Select value={form.assigned_to} onValueChange={v => setForm({ ...form, assigned_to: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={members.length === 0 ? "جارٍ التحميل..." : "اختر الموظف"} />
                      </SelectTrigger>
                      <SelectContent>
                        {members.filter(m => m.role === "individual").map(m => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.full_name} {m.unit ? `— ${m.unit === "preparation" ? "الإعداد" : "المناهج"}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>ساعات مقدّرة</Label>
                      <Input type="number" min="0" step="0.5" placeholder="مثال: 4" value={form.estimated_hours} onChange={e => setForm({ ...form, estimated_hours: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>تاريخ الاستحقاق</Label>
                      <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                    </div>
                  </div>

                  {role === "admin" && (
                    <div className="flex items-center justify-between p-2 border rounded-lg">
                      <Label className="text-sm">السماح لرئيس الشعبة بالمتابعة</Label>
                      <Switch
                        checked={form.is_visible_to_unit_head}
                        onCheckedChange={v => setForm({ ...form, is_visible_to_unit_head: v })}
                      />
                    </div>
                  )}

                  <Button type="submit" className="w-full gradient-primary">إنشاء المهمة</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search & Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pr-10"
              placeholder="بحث في المهام..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusFilters.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  statusFilter === f.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {f.label}
                {f.value !== "all" && (
                  <span className="mr-1 opacity-60">
                    ({tasks.filter(t => t.status === f.value).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد مهام {search || statusFilter !== "all" ? "تطابق البحث" : "بعد"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTasks.map(t => (
              <Card
                key={t.id}
                className="hover:shadow-elevated transition-shadow cursor-pointer border-0 shadow-card"
                onClick={() => { setDetailTask(t); setDetailDialogOpen(true); }}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <Badge className={`text-xs ${statusColors[t.status] ?? ""}`}>{statusLabels[t.status]}</Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(t.created_at), { locale: ar, addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm mb-1 leading-snug">{t.title}</h3>
                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  )}
                  {t.due_date && (
                    <p className="text-xs text-warning mt-2">
                      الاستحقاق: {new Date(t.due_date).toLocaleDateString("ar-SA")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="mx-4 sm:mx-auto max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">{detailTask?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Badge className={statusColors[detailTask?.status] ?? ""}>{statusLabels[detailTask?.status]}</Badge>
              {detailTask?.description && (
                <p className="text-sm text-muted-foreground">{detailTask.description}</p>
              )}
              {detailTask?.due_date && (
                <p className="text-xs text-warning">الاستحقاق: {new Date(detailTask.due_date).toLocaleDateString("ar-SA")}</p>
              )}
              {detailTask?.estimated_hours && (
                <p className="text-xs text-muted-foreground">الساعات المقدّرة: {detailTask.estimated_hours}</p>
              )}

              <div className="flex flex-col gap-2">
                {(role === "admin" || role === "unit_head") && detailTask?.assigned_to === user?.id && (
                  <Button variant="outline" className="w-full" onClick={() => setForwardDialogOpen(true)}>
                    <ArrowRight className="ml-2 h-4 w-4" /> تحويل لموظف
                  </Button>
                )}
                {role === "individual" && detailTask?.status === "assigned" && (
                  <Button className="w-full gradient-primary" onClick={() => updateStatus(detailTask.id, "in_progress")}>
                    بدء العمل
                  </Button>
                )}
                {role === "individual" && detailTask?.status === "in_progress" && (
                  <Button className="w-full gradient-primary" onClick={() => updateStatus(detailTask.id, "under_review")}>
                    تم الإنجاز — إرسال للمراجعة
                  </Button>
                )}
                {(role === "admin" || role === "unit_head") && detailTask?.status === "under_review" && (
                  <>
                    <Button className="w-full bg-success text-success-foreground hover:bg-success/90" onClick={() => updateStatus(detailTask.id, "approved", { points_awarded: 10 })}>
                      اعتماد المهمة ✓
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => updateStatus(detailTask.id, "assigned")}>
                      إعادة للموظف
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Forward Dialog */}
        <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
          <DialogContent className="mx-4 sm:mx-auto max-w-sm">
            <DialogHeader><DialogTitle>تحويل المهمة لموظف آخر</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Select onValueChange={setForwardUserId}>
                <SelectTrigger><SelectValue placeholder="اختر الموظف الجديد" /></SelectTrigger>
                <SelectContent>
                  {members.filter(m => m.role === "individual").map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full gradient-primary" onClick={handleForward}>تأكيد التحويل</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
