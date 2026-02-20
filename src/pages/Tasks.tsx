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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Plus, Search, ArrowRight, Send, MessageSquare, Users2, HelpCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
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
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<any | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // تحديث النموذج ليدعم مصفوفة أشخاص وخيار طلب مساعدة
  const [form, setForm] = useState({
    title: "", 
    description: "", 
    assigned_to: [] as string[],
    due_date: "",
    allow_assistance: true // الخيار الجديد
  });

  useEffect(() => {
    fetchTasks();
    fetchMembers();
  }, [role]);

  const fetchTasks = async () => {
    setLoading(true);
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (role === "individual") query = query.eq("assigned_to", user?.id);
    const { data } = await query;
    setTasks(data ?? []);
    setLoading(false);
  };

  const fetchMembers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, unit");
    const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");
    const roleMap: Record<string, string> = {};
    rolesData?.forEach((r: any) => { roleMap[r.user_id] = r.role; });
    setMembers(profiles?.map((p: any) => ({
      ...p,
      role: roleMap[p.user_id] ?? "individual",
    })) ?? []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.assigned_to.length === 0) {
      toast({ title: "يرجى اختيار موظف واحد على الأقل", variant: "destructive" });
      return;
    }

    // إنشاء نسخة من المهمة لكل موظف مختار
    const tasksToInsert = form.assigned_to.map(userId => ({
      title: form.title,
      description: form.description + (form.allow_assistance ? "\n[💡 مسموح لهذا الموظف بطلب مساعدة من زملائه]" : ""),
      assigned_to: userId,
      assigned_by: user!.id,
      unit: members.find(m => m.user_id === userId)?.unit,
      due_date: form.due_date || null,
      status: 'assigned'
    }));

    const { error } = await supabase.from("tasks").insert(tasksToInsert);

    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      toast({ title: "تم توزيع المهام بنجاح" });
      setDialogOpen(false);
      setForm({ title: "", description: "", assigned_to: [], due_date: "", allow_assistance: true });
      fetchTasks();
    }
  };

  const openTaskDetail = (t: any) => {
    setDetailTask(t);
    setDetailDialogOpen(true);
    fetchComments(t.id);
  };

  const fetchComments = async (taskId: string) => {
    const { data } = await supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at", { ascending: true });
    setComments(data ?? []);
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !detailTask) return;
    const { error } = await supabase.from("task_comments").insert({
      task_id: detailTask.id, user_id: user!.id, message: newComment.trim(),
    });
    if (!error) { setNewComment(""); fetchComments(detailTask.id); }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (!error) {
      toast({ title: "تم التحديث" });
      fetchTasks();
      setDetailDialogOpen(false);
    }
  };

  const filteredTasks = tasks.filter(t => (!search || t.title?.includes(search)) && (statusFilter === "all" || t.status === statusFilter));

  return (
    <AppLayout>
      <div className="space-y-4 p-2 sm:p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardList className="text-primary" /> إدارة المهام</h1>
          {(role === "admin" || role === "unit_head") && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary"><Plus className="ml-2 h-4 w-4" /> مهمة جماعية</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>تكليف بمهمة جديدة</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <Input placeholder="عنوان المهمة" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                  <Textarea placeholder="التفاصيل..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-bold flex items-center gap-1"><Users2 className="w-3 h-3" /> الموظفين المكلّفين (اختر أكثر من شخص)</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border rounded-lg bg-slate-50">
                      {members.filter(m => m.role === "individual").map(m => (
                        <label key={m.user_id} className="flex items-center gap-2 text-xs cursor-pointer p-1 hover:bg-white rounded transition-colors">
                          <input 
                            type="checkbox" 
                            checked={form.assigned_to.includes(m.user_id)}
                            onChange={(e) => {
                              if (e.target.checked) setForm({...form, assigned_to: [...form.assigned_to, m.user_id]});
                              else setForm({...form, assigned_to: form.assigned_to.filter(id => id !== m.user_id)});
                            }}
                            className="accent-primary w-4 h-4"
                          />
                          {m.full_name}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/50">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-blue-600" />
                      <Label className="text-xs cursor-pointer" htmlFor="assist-switch">السماح لهذا الفرد بطلب مساعدة</Label>
                    </div>
                    <Switch 
                      id="assist-switch"
                      checked={form.allow_assistance} 
                      onCheckedChange={v => setForm({...form, allow_assistance: v})} 
                    />
                  </div>

                  <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                  <Button type="submit" className="w-full gradient-primary font-bold">توزيع المهمة للكل</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pr-10" placeholder="بحث في مهامك..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTasks.map(t => (
            <Card key={t.id} className="cursor-pointer hover:shadow-elevated border-0 shadow-card transition-shadow" onClick={() => openTaskDetail(t)}>
              <CardContent className="p-4">
                <Badge className={`text-[10px] mb-2 ${statusColors[t.status]}`}>{statusLabels[t.status]}</Badge>
                <h3 className="font-bold text-sm mb-1 leading-snug">{t.title}</h3>
                <p className="text-[10px] text-muted-foreground line-clamp-2">{t.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-base">{detailTask?.title}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground whitespace-pre-wrap p-3 bg-muted rounded-lg leading-relaxed">{detailTask?.description}</p>
              
              <div className="border-t pt-3">
                <h4 className="text-sm font-bold flex items-center gap-1 mb-2"><MessageSquare className="w-4 h-4" /> التعليقات ({comments.length})</h4>
                <div className="max-h-40 overflow-y-auto space-y-2 mb-2 p-1">
                  {comments.map(c => (
                    <div key={c.id} className={`p-2 rounded-lg text-[11px] ${c.user_id === user?.id ? "bg-primary/10 mr-6" : "bg-muted ml-6"}`}>
                      <p className="font-bold mb-1 text-[10px]">{members.find(m => m.user_id === c.user_id)?.full_name}</p>
                      <p>{c.message}</p>
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
                <div className="flex gap-2">
                  <Input placeholder="أضف تعليقاً..." value={newComment} onChange={e => setNewComment(e.target.value)} className="text-xs" />
                  <Button size="sm" onClick={handleSendComment}><Send className="w-4 h-4" /></Button>
                </div>
              </div>

              {role === "individual" && detailTask?.status === "assigned" && <Button className="w-full gradient-primary" onClick={() => updateStatus(detailTask.id, "in_progress")}>بدء العمل</Button>}
              {role === "individual" && detailTask?.status === "in_progress" && <Button className="w-full gradient-primary" onClick={() => updateStatus(detailTask.id, "under_review")}>إرسال للمراجعة</Button>}
              {(role === "admin" || role === "unit_head") && detailTask?.status === "under_review" && (
                <div className="flex gap-2">
                  <Button className="flex-1 bg-success hover:bg-success/90 text-white" onClick={() => updateStatus(detailTask.id, "approved")}>اعتماد ✓</Button>
                  <Button variant="outline" className="flex-1" onClick={() => updateStatus(detailTask.id, "assigned")}>إعادة للموظف</Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
