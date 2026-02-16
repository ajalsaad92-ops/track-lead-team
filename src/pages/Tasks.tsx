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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Plus, Award, CheckCircle, Play, Send, RotateCcw, Eye, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  assigned: "مكلّف", in_progress: "قيد التنفيذ", completed: "مكتمل",
  under_review: "قيد المراجعة", approved: "معتمد", suspended: "معلّق",
};
const statusColors: Record<string, string> = {
  assigned: "bg-warning/10 text-warning", in_progress: "bg-info/10 text-info",
  completed: "bg-primary/10 text-primary", under_review: "bg-secondary/10 text-secondary",
  approved: "bg-success/10 text-success", suspended: "bg-destructive/10 text-destructive",
};

export default function TasksPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [points, setPoints] = useState(0);
  const [detailTask, setDetailTask] = useState<any | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [approvePoints, setApprovePoints] = useState("1");
  const [reviewNotes, setReviewNotes] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", task_type: "regular_task", assigned_to: "",
    estimated_hours: "", due_date: "",
  });

  useEffect(() => {
    fetchTasks();
    if (role === "admin" || role === "unit_head") fetchMembers();
  }, [role]);

  const fetchTasks = async () => {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    setTasks(data ?? []);
    if (role === "individual" && user) {
      const total = (data ?? []).filter((t: any) => t.assigned_to === user.id && t.status === "approved")
        .reduce((s: number, t: any) => s + (t.points_awarded || 0), 0);
      setPoints(total);
    }
    setLoading(false);
  };

  const fetchMembers = async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name");
    setMembers(data ?? []);
  };

  const getMemberName = (id: string) => members.find(m => m.user_id === id)?.full_name ?? "—";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("tasks").insert({
      title: form.title, description: form.description,
      task_type: form.task_type as any, assigned_to: form.assigned_to,
      assigned_by: user!.id,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      due_date: form.due_date || null,
      unit: (await supabase.from("profiles").select("unit").eq("user_id", form.assigned_to).single()).data?.unit as any,
    });
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم إنشاء المهمة" }); setDialogOpen(false); fetchTasks(); }
  };

  const updateStatus = async (id: string, status: string, extra?: Record<string, any>) => {
    const updates: any = { status, ...extra };
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم تحديث المهمة" }); fetchTasks(); setDetailDialogOpen(false); }
  };

  const openDetail = (t: any) => {
    setDetailTask(t);
    setApprovePoints(String(t.points_awarded || 1));
    setReviewNotes("");
    setCompletionNotes(t.completion_notes ?? "");
    setDetailDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-cairo flex items-center gap-2">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />إدارة المهام
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">تكليف ومتابعة المهام ونظام النقاط</p>
          </div>
          <div className="flex items-center gap-3">
            {role === "individual" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-success/10 rounded-lg">
                <Award className="w-5 h-5 text-success" />
                <span className="text-sm font-bold text-success">{points} نقطة</span>
              </div>
            )}
            {(role === "admin" || role === "unit_head") && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary text-white gap-2"><Plus className="w-4 h-4" />مهمة جديدة</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-cairo">إنشاء مهمة جديدة</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label>عنوان المهمة *</Label>
                      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>الوصف</Label>
                      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>النوع</Label>
                        <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="regular_task">مهمة اعتيادية</SelectItem>
                            <SelectItem value="curriculum_task">مهمة مناهج</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>المكلّف</Label>
                        <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                          <SelectTrigger><SelectValue placeholder="اختر العضو" /></SelectTrigger>
                          <SelectContent>
                            {members.map((m) => (
                              <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>الساعات المطلوبة</Label>
                        <Input type="number" step="0.5" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>الموعد النهائي</Label>
                        <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                      </div>
                    </div>
                    <Button type="submit" className="w-full gradient-primary text-white">إنشاء المهمة</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <Card className="shadow-card border-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المهمة</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الساعات</TableHead>
                  <TableHead className="text-right">النقاط</TableHead>
                  <TableHead className="text-right">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد مهام</TableCell></TableRow>
                ) : tasks.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(t)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{t.title}</p>
                        {t.description && <p className="text-xs text-muted-foreground truncate max-w-48">{t.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{t.task_type === "curriculum_task" ? "مناهج" : "اعتيادية"}</Badge></TableCell>
                    <TableCell><Badge className={statusColors[t.status] ?? ""}>{statusLabels[t.status] ?? t.status}</Badge></TableCell>
                    <TableCell>{t.estimated_hours ?? "—"}</TableCell>
                    <TableCell>{t.points_awarded || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {role === "individual" && t.assigned_to === user?.id && (
                          <>
                            {t.status === "assigned" && (
                              <Button size="sm" variant="ghost" className="h-7 gap-1 text-info" onClick={() => updateStatus(t.id, "in_progress")}>
                                <Play className="w-3 h-3" />بدء
                              </Button>
                            )}
                            {t.status === "in_progress" && (
                              <Button size="sm" variant="ghost" className="h-7 gap-1 text-primary" onClick={() => openDetail(t)}>
                                <Send className="w-3 h-3" />رفع
                              </Button>
                            )}
                          </>
                        )}
                        {(role === "admin" || role === "unit_head") && t.status === "under_review" && (
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-success" onClick={() => openDetail(t)}>
                            <Eye className="w-3 h-3" />مراجعة
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        {/* Task Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-cairo">تفاصيل المهمة</DialogTitle></DialogHeader>
            {detailTask && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-bold text-lg">{detailTask.title}</h3>
                  {detailTask.description && <p className="text-sm text-muted-foreground">{detailTask.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs">المكلّف</p>
                    <p className="font-medium">{getMemberName(detailTask.assigned_to)}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs">منشئ المهمة</p>
                    <p className="font-medium">{getMemberName(detailTask.assigned_by)}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs">الحالة</p>
                    <Badge className={statusColors[detailTask.status] ?? ""}>{statusLabels[detailTask.status]}</Badge>
                  </div>
                  <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">منذ التكليف</p>
                      <p className="font-medium text-xs">{formatDistanceToNow(new Date(detailTask.created_at), { locale: ar, addSuffix: true })}</p>
                    </div>
                  </div>
                </div>

                {detailTask.completion_notes && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs">ملاحظات الإنجاز</p>
                    <p className="text-sm">{detailTask.completion_notes}</p>
                  </div>
                )}
                {detailTask.review_notes && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs">ملاحظات المراجعة</p>
                    <p className="text-sm">{detailTask.review_notes}</p>
                  </div>
                )}

                {/* Individual: submit for review */}
                {role === "individual" && detailTask.assigned_to === user?.id && detailTask.status === "in_progress" && (
                  <div className="space-y-2 border-t pt-3">
                    <Label>ملاحظات الإنجاز</Label>
                    <Textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="أضف ملاحظات عن العمل المنجز..." />
                    <Button className="w-full gradient-primary text-white gap-2" onClick={() => updateStatus(detailTask.id, "under_review", { completion_notes: completionNotes })}>
                      <Send className="w-4 h-4" />رفع للمراجعة
                    </Button>
                  </div>
                )}

                {/* Creator: approve / rework */}
                {(role === "admin" || role === "unit_head") && detailTask.status === "under_review" && (
                  <div className="space-y-3 border-t pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>النقاط</Label>
                        <Input type="number" min="0" max="100" value={approvePoints} onChange={(e) => setApprovePoints(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>ملاحظات المراجعة</Label>
                        <Input value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="اختياري" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1 gap-1 bg-success hover:bg-success/90 text-white"
                        onClick={() => updateStatus(detailTask.id, "approved", { points_awarded: parseInt(approvePoints) || 1, review_notes: reviewNotes || null })}>
                        <CheckCircle className="w-4 h-4" />اعتماد
                      </Button>
                      <Button variant="outline" className="flex-1 gap-1 text-warning border-warning"
                        onClick={() => updateStatus(detailTask.id, "assigned", { review_notes: reviewNotes || "مطلوب إعادة العمل" })}>
                        <RotateCcw className="w-4 h-4" />إعادة للتعديل
                      </Button>
                    </div>
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
