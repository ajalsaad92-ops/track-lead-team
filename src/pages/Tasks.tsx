import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Plus, Award, CheckCircle, Play, Send, RotateCcw,
  Eye, Clock, Search, Filter, MessageCircle, X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

const statusLabels: Record<string, string> = {
  assigned: "مكلّف", in_progress: "قيد التنفيذ", completed: "مكتمل",
  under_review: "قيد المراجعة", approved: "معتمد", suspended: "معلّق",
};
const statusColors: Record<string, string> = {
  assigned: "bg-warning/10 text-warning border border-warning/30",
  in_progress: "bg-info/10 text-info border border-info/30",
  completed: "bg-primary/10 text-primary border border-primary/30",
  under_review: "bg-secondary/10 text-secondary border border-secondary/30",
  approved: "bg-success/10 text-success border border-success/30",
  suspended: "bg-destructive/10 text-destructive border border-destructive/30",
};

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export default function TasksPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
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

  // Search & filter
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTasks();
    if (role === "admin" || role === "unit_head") fetchMembers();
  }, [role]);

  // Realtime comments subscription when a task detail is open
  useEffect(() => {
    if (!detailTask) return;

    fetchComments(detailTask.id);

    const channel = supabase
      .channel(`task-comments-${detailTask.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "task_comments",
        filter: `task_id=eq.${detailTask.id}`,
      }, (payload) => {
        setComments((prev) => [...prev, payload.new as Comment]);
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [detailTask?.id]);

  const fetchTasks = async () => {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    setTasks(data ?? []);
    if (role === "individual" && user) {
      const total = (data ?? [])
        .filter((t: any) => t.assigned_to === user.id && t.status === "approved")
        .reduce((s: number, t: any) => s + (t.points_awarded || 0), 0);
      setPoints(total);
    }
    setLoading(false);
  };

  const fetchMembers = async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name");
    setMembers(data ?? []);
  };

  const fetchComments = async (taskId: string) => {
    const { data } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    setComments(data ?? []);
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const getMemberName = (id: string) => members.find(m => m.user_id === id)?.full_name ?? "—";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const unitRes = await supabase.from("profiles").select("unit").eq("user_id", form.assigned_to).single();
    const { error } = await supabase.from("tasks").insert({
      title: form.title, description: form.description,
      task_type: form.task_type as any, assigned_to: form.assigned_to,
      assigned_by: user!.id,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      due_date: form.due_date || null,
      unit: unitRes.data?.unit as any,
    });
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      toast({ title: "تم إنشاء المهمة" });
      setDialogOpen(false);
      setForm({ title: "", description: "", task_type: "regular_task", assigned_to: "", estimated_hours: "", due_date: "" });
      fetchTasks();
    }
  };

  const updateStatus = async (id: string, status: string, extra?: Record<string, any>) => {
    const updates: any = { status, ...extra };
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      toast({ title: "تم تحديث المهمة" });
      fetchTasks();
      setDetailTask((prev: any) => prev ? { ...prev, status, ...extra } : null);
    }
  };

  const sendComment = async () => {
    if (!commentText.trim() || !detailTask) return;
    setSendingComment(true);
    const { error } = await supabase.from("task_comments").insert({
      task_id: detailTask.id,
      user_id: user!.id,
      message: commentText.trim(),
    });
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else setCommentText("");
    setSendingComment(false);
  };

  const openDetail = (t: any) => {
    setDetailTask(t);
    setApprovePoints(String(t.points_awarded || 1));
    setReviewNotes("");
    setCompletionNotes(t.completion_notes ?? "");
    setDetailDialogOpen(true);
  };

  const filteredTasks = tasks.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const renderTaskCard = (t: any) => {
    const isAssignee = role === "individual" && t.assigned_to === user?.id;
    const isManager = role === "admin" || role === "unit_head";
    return (
      <Card
        key={t.id}
        className="shadow-card border-0 cursor-pointer hover:shadow-elevated transition-all active:scale-[0.99]"
        onClick={() => openDetail(t)}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm leading-tight flex-1">{t.title}</h3>
            <Badge className={`text-xs shrink-0 ${statusColors[t.status] ?? ""}`}>
              {statusLabels[t.status] ?? t.status}
            </Badge>
          </div>
          {t.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {t.task_type === "curriculum_task" ? "مناهج" : "اعتيادية"}
              </Badge>
              {t.estimated_hours && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />{t.estimated_hours}س
                </span>
              )}
              {t.points_awarded > 0 && (
                <span className="text-xs text-success flex items-center gap-1">
                  <Award className="w-3 h-3" />{t.points_awarded}
                </span>
              )}
            </div>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {isAssignee && t.status === "assigned" && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-info border-info/30" onClick={() => updateStatus(t.id, "in_progress")}>
                  <Play className="w-3 h-3" />بدء
                </Button>
              )}
              {isAssignee && t.status === "in_progress" && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-primary border-primary/30" onClick={() => openDetail(t)}>
                  <Send className="w-3 h-3" />رفع
                </Button>
              )}
              {isManager && t.status === "under_review" && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-success border-success/30" onClick={() => openDetail(t)}>
                  <Eye className="w-3 h-3" />مراجعة
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(t.created_at), { locale: ar, addSuffix: true })}
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-cairo flex items-center gap-2">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />إدارة المهام
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">تكليف ومتابعة المهام ونظام النقاط</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {role === "individual" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-success/10 rounded-lg border border-success/20">
                <Award className="w-4 h-4 text-success" />
                <span className="text-sm font-bold text-success">{points} نقطة</span>
              </div>
            )}
            {(role === "admin" || role === "unit_head") && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary text-white gap-2 w-full sm:w-auto">
                    <Plus className="w-4 h-4" />مهمة جديدة
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg mx-4 sm:mx-auto">
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
                        <Label>المكلّف *</Label>
                        <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                          <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
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
                        <Label>الساعات</Label>
                        <Input type="number" step="0.5" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>الموعد النهائي</Label>
                        <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                      </div>
                    </div>
                    <Button type="submit" className="w-full gradient-primary text-white" disabled={!form.assigned_to}>إنشاء المهمة</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن مهمة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="assigned">مكلّف</SelectItem>
                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                <SelectItem value="under_review">قيد المراجعة</SelectItem>
                <SelectItem value="approved">معتمد</SelectItem>
                <SelectItem value="suspended">معلّق</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="flex gap-2 flex-wrap">
            {Object.entries(statusLabels).map(([key, label]) => {
              const count = tasks.filter(t => t.status === key).length;
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  onClick={() => setFilterStatus(filterStatus === key ? "all" : key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${filterStatus === key ? statusColors[key] : "bg-muted text-muted-foreground border-border hover:border-primary/40"}`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Tasks List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>{search || filterStatus !== "all" ? "لا توجد نتائج" : "لا توجد مهام بعد"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTasks.map(renderTaskCard)}
          </div>
        )}

        {/* Task Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={(o) => { setDetailDialogOpen(o); if (!o) { setDetailTask(null); setComments([]); setCommentText(""); } }}>
          <DialogContent className="max-w-lg mx-2 sm:mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-cairo text-base">تفاصيل المهمة</DialogTitle>
            </DialogHeader>
            {detailTask && (
              <div className="space-y-4">
                {/* Task info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg leading-tight">{detailTask.title}</h3>
                    <Badge className={`shrink-0 ${statusColors[detailTask.status] ?? ""}`}>
                      {statusLabels[detailTask.status]}
                    </Badge>
                  </div>
                  {detailTask.description && <p className="text-sm text-muted-foreground">{detailTask.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2.5 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs mb-0.5">المكلّف</p>
                    <p className="font-medium text-sm">{getMemberName(detailTask.assigned_to)}</p>
                  </div>
                  <div className="p-2.5 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs mb-0.5">المكلِّف</p>
                    <p className="font-medium text-sm">{getMemberName(detailTask.assigned_by)}</p>
                  </div>
                  {detailTask.estimated_hours && (
                    <div className="p-2.5 bg-muted rounded-lg">
                      <p className="text-muted-foreground text-xs mb-0.5">الساعات</p>
                      <p className="font-medium text-sm">{detailTask.estimated_hours} ساعة</p>
                    </div>
                  )}
                  <div className="p-2.5 bg-muted rounded-lg flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">وقت الإنشاء</p>
                      <p className="font-medium text-xs">{formatDistanceToNow(new Date(detailTask.created_at), { locale: ar, addSuffix: true })}</p>
                    </div>
                  </div>
                </div>

                {detailTask.completion_notes && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs mb-1">ملاحظات الإنجاز</p>
                    <p className="text-sm">{detailTask.completion_notes}</p>
                  </div>
                )}
                {detailTask.review_notes && (
                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <p className="text-warning text-xs mb-1 font-medium">ملاحظات المراجعة</p>
                    <p className="text-sm">{detailTask.review_notes}</p>
                  </div>
                )}

                {/* Actions */}
                {role === "individual" && detailTask.assigned_to === user?.id && detailTask.status === "in_progress" && (
                  <div className="space-y-2 border-t pt-3">
                    <Label>ملاحظات الإنجاز</Label>
                    <Textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="أضف ملاحظات عن العمل المنجز..." rows={3} />
                    <Button className="w-full gradient-primary text-white gap-2" onClick={() => updateStatus(detailTask.id, "under_review", { completion_notes: completionNotes })}>
                      <Send className="w-4 h-4" />رفع للمراجعة
                    </Button>
                  </div>
                )}

                {role === "individual" && detailTask.assigned_to === user?.id && detailTask.status === "assigned" && (
                  <Button className="w-full gap-2 text-info border-info/30" variant="outline" onClick={() => updateStatus(detailTask.id, "in_progress")}>
                    <Play className="w-4 h-4" />بدء التنفيذ
                  </Button>
                )}

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

                {/* Comments Section */}
                <div className="border-t pt-3 space-y-3">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    التعليقات والتواصل
                    {comments.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{comments.length}</Badge>
                    )}
                  </h4>

                  {/* Comments list */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">لا توجد تعليقات بعد — ابدأ المحادثة!</p>
                    ) : (
                      comments.map((c) => {
                        const isMe = c.user_id === user?.id;
                        return (
                          <div key={c.id} className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
                            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"}`}>
                              <p>{c.message}</p>
                              <p className={`text-[10px] mt-0.5 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                {formatDistanceToNow(new Date(c.created_at), { locale: ar, addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={commentsEndRef} />
                  </div>

                  {/* Comment input */}
                  <div className="flex gap-2">
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="اكتب تعليقاً..."
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                      className="flex-1 text-sm"
                    />
                    <Button
                      size="icon"
                      onClick={sendComment}
                      disabled={!commentText.trim() || sendingComment}
                      className="gradient-primary text-white shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
