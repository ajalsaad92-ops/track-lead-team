import { useState, useEffect, useRef } from "react";
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
import { Switch } from "@/components/ui/switch"; // أضفنا زر التبديل
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Plus, Award, CheckCircle, Play, Send, RotateCcw,
  Eye, Clock, Search, Filter, MessageCircle, X, ArrowRight
} from "lucide-react";
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
  
  // حقول الفورم الجديد
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

    // تطبيق منطق الخصوصية الذي طلبته
    if (role === "individual") {
      query = query.eq("assigned_to", user?.id);
    } else if (role === "unit_head") {
      const { data: profile } = await supabase.from("profiles").select("unit").eq("user_id", user?.id).single();
      // رئيس الشعبة يرى مهام وحدته بشرط أن تكون مرئية له (is_visible_to_unit_head)
      // أو المهام التي هو كلف بها أو كلفها بنفسه
      query = query.or(`assigned_to.eq.${user?.id},assigned_by.eq.${user?.id},and(unit.eq.${profile?.unit},is_visible_to_unit_head.eq.true)`);
    }
    // الأدمن يرى الكل تلقائياً

    const { data } = await query;
    setTasks(data ?? []);
    
    if (role === "individual") {
      const total = (data ?? []).filter(t => t.status === "approved").reduce((s, t) => s + (t.points_awarded || 0), 0);
      setPoints(total);
    }
    setLoading(false);
  };

  const fetchMembers = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, unit").eq("is_disabled", false),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const rolesMap: Record<string, string> = {};
    (rolesRes.data ?? []).forEach(r => { rolesMap[r.user_id] = r.role; });
    const merged = (profilesRes.data ?? []).map(p => ({
      ...p,
      role: rolesMap[p.user_id] ?? "individual",
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

  return (
    <AppLayout>
      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="text-primary" /> إدارة المهام
            </h1>
            {role === "individual" && <p className="text-success font-bold">نقاطك: {points}</p>}
          </div>

          {(role === "admin" || role === "unit_head") && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary"><Plus className="ml-2 h-4 w-4" /> مهمة جديدة</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>تكليف بمهمة</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <Input placeholder="عنوان المهمة" onChange={e => setForm({...form, title: e.target.value})} required />
                  <Textarea placeholder="التفاصيل" onChange={e => setForm({...form, description: e.target.value})} />
                  
                  <Select onValueChange={v => setForm({...form, assigned_to: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder={members.length === 0 ? "لا يوجد موظفون..." : "اختر الموظف"} />
                    </SelectTrigger>
                    <SelectContent>
                      {members.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">لا يوجد موظفون متاحون</div>
                      ) : (
                        members.map(m => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.full_name} {m.unit ? `(${m.unit === 'curriculum' ? 'المناهج' : 'الإعداد'})` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {role === "admin" && (
                    <div className="flex items-center justify-between p-2 border rounded-lg">
                      <Label>السماح لرئيس الشعبة بالمتابعة</Label>
                      <Switch 
                        checked={form.is_visible_to_unit_head} 
                        onCheckedChange={v => setForm({...form, is_visible_to_unit_head: v})} 
                      />
                    </div>
                  )}
                  
                  <Button type="submit" className="w-full">إنشاء</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map(t => (
            <Card key={t.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => {setDetailTask(t); setDetailDialogOpen(true);}}>
              <CardContent className="p-4">
                <div className="flex justify-between mb-2">
                  <Badge className={statusColors[t.status]}>{statusLabels[t.status]}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), {locale: ar})}</span>
                </div>
                <h3 className="font-bold mb-1">{t.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{detailTask?.title}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm">{detailTask?.description}</p>
              
              {/* أزرار الإجراءات */}
              <div className="flex gap-2">
                {role === "unit_head" && detailTask?.assigned_to === user?.id && (
                  <Button variant="outline" className="w-full" onClick={() => setForwardDialogOpen(true)}>
                    <ArrowRight className="ml-2 h-4 w-4" /> تحويل لموظف
                  </Button>
                )}
                {role === "individual" && detailTask?.status === "assigned" && (
                  <Button className="w-full" onClick={() => updateStatus(detailTask.id, "in_progress")}>بدء العمل</Button>
                )}
                {role === "individual" && detailTask?.status === "in_progress" && (
                  <Button className="w-full" onClick={() => updateStatus(detailTask.id, "under_review")}>تم الإنجاز</Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Forward Dialog */}
        <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>تحويل المهمة لموظف آخر</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Select onValueChange={setForwardUserId}>
                <SelectTrigger><SelectValue placeholder="اختر الموظف الجديد" /></SelectTrigger>
                <SelectContent>
                  {members.filter(m => m.unit === detailTask?.unit && m.role === 'individual').map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={handleForward}>تأكيد التحويل</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
