import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Eye, Upload, FileSpreadsheet, ArrowLeft, Pencil } from "lucide-react";

const stageFlow = ["form", "audit", "printed", "completed"] as const;
const stageLabels: Record<string, string> = {
  printed: "طباعة", form: "فورمة", powerpoint: "بوربوينت", application: "تطبيق",
  objectives: "أهداف", audit: "تدقيق", completed: "منجز",
};
const stageColors: Record<string, string> = {
  printed: "hsl(38,92%,50%)", form: "hsl(217,91%,50%)", powerpoint: "hsl(262,83%,58%)",
  application: "hsl(168,76%,42%)", objectives: "hsl(199,89%,48%)", audit: "hsl(0,84%,60%)", completed: "hsl(152,69%,40%)",
};
const auditLabels: Record<string, string> = { done: "تم", in_progress: "جاري", not_started: "لم يتم" };

// Auto stage calculation
function computeStage(c: any): string {
  if (c.is_printed && c.audit_status === "done" && c.form_type) return "completed";
  if (c.is_printed && c.audit_status === "done") return "printed";
  if (c.audit_status === "done") return "audit";
  if (c.form_type) return "form";
  return "form";
}

const emptyForm = {
  title: "", is_printed: false, form_type: "new", powerpoint_status: "new",
  target_groups: "", is_applied: false, objectives: "", executing_entity: "internal",
  hours: "", prepared_by: "", location: "", trainer: "", audit_status: "not_started",
  target_group_count: "",
};

export default function CurriculaPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [curricula, setCurricula] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "curricula_diagram" | "presentations_diagram">("table");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [pptFilterStage, setPptFilterStage] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => { fetchCurricula(); fetchProfiles(); }, []);

  const fetchCurricula = async () => {
    const { data } = await supabase.from("curricula").select("*").order("created_at", { ascending: false });
    setCurricula(data ?? []);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name");
    setProfiles(data ?? []);
  };

  const resetForm = () => setForm({ ...emptyForm });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const record = buildRecord();
    const insertData = { ...record, created_by: user!.id, unit: "curriculum" as any, stage: computeStage(record) as any };
    const { error } = await supabase.from("curricula").insert(insertData);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم إضافة المنهاج بنجاح" }); setDialogOpen(false); resetForm(); fetchCurricula(); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    const record = buildRecord();
    const updateData = { ...record, stage: computeStage(record) as any };
    // Get old values for audit log
    const oldCurriculum = curricula.find(c => c.id === editId);
    const { error } = await supabase.from("curricula").update(updateData).eq("id", editId);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      // Log changes to audit_log
      if (oldCurriculum && user) {
        const changes: Record<string, { old: any; new: any }> = {};
        Object.keys(updateData).forEach(key => {
          if (key === "stage") return;
          const oldVal = oldCurriculum[key];
          const newVal = (updateData as any)[key];
          if (String(oldVal ?? "") !== String(newVal ?? "")) {
            changes[key] = { old: oldVal, new: newVal };
          }
        });
        if (Object.keys(changes).length > 0) {
          await supabase.from("audit_log").insert({
            user_id: user.id,
            action: "update_curriculum",
            target_type: "curricula",
            target_id: editId,
            details: { changes, title: oldCurriculum.title },
          });
        }
      }
      toast({ title: "تم تحديث المنهاج" }); setEditDialogOpen(false); resetForm(); fetchCurricula();
    }
  };

  const buildRecord = () => ({
    title: form.title,
    is_printed: form.is_printed,
    form_type: form.form_type,
    powerpoint_status: form.powerpoint_status,
    target_groups: form.target_groups,
    is_applied: form.is_applied,
    objectives: form.objectives,
    executing_entity: form.executing_entity,
    hours: form.hours ? parseFloat(form.hours) : null,
    prepared_by: form.prepared_by,
    location: form.location,
    trainer: form.trainer,
    audit_status: form.audit_status as any,
  });

  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      title: c.title ?? "", is_printed: c.is_printed ?? false,
      form_type: c.form_type ?? "new", powerpoint_status: c.powerpoint_status ?? "new",
      target_groups: c.target_groups ?? "", is_applied: c.is_applied ?? false,
      objectives: c.objectives ?? "", executing_entity: c.executing_entity ?? "internal",
      hours: c.hours != null ? String(c.hours) : "", prepared_by: c.prepared_by ?? "",
      location: c.location ?? "", trainer: c.trainer ?? "",
      audit_status: c.audit_status ?? "not_started", target_group_count: "",
    });
    setEditDialogOpen(true);
  };

  const handleFileUpload = async (curriculumId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.pptx,.ppt,.doc,.docx";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const path = `${curriculumId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("curriculum-files").upload(path, file);
      if (uploadError) { toast({ title: "خطأ في الرفع", description: uploadError.message, variant: "destructive" }); return; }
      const curr = curricula.find(c => c.id === curriculumId);
      const existingUrls = Array.isArray(curr?.file_urls) ? curr.file_urls : [];
      await supabase.from("curricula").update({
        file_urls: [...existingUrls, { path, name: file.name, type: file.name.endsWith(".pdf") ? "PDF" : "PowerPoint" }],
      }).eq("id", curriculumId);
      toast({ title: "تم رفع الملف بنجاح" });
      fetchCurricula();
    };
    input.click();
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (jsonData.length < 2) { toast({ title: "الملف فارغ", variant: "destructive" }); return; }
      const headers = (jsonData[0] as any[]).map((h: any) => String(h ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
      const fieldMap: Record<string, string> = {
        "العنوان": "title", "title": "title", "مطبوع": "is_printed", "printed": "is_printed",
        "فورمة": "form_type", "form": "form_type", "form_type": "form_type",
        "بور بوينت": "powerpoint_status", "بوربوينت": "powerpoint_status", "powerpoint": "powerpoint_status",
        "الفئات المستهدفة": "target_groups", "target_groups": "target_groups",
        "التطبيق": "is_applied", "applied": "is_applied",
        "الأهداف": "objectives", "الاهداف": "objectives", "objectives": "objectives",
        "الجهة المنفذة": "executing_entity", "executing_entity": "executing_entity",
        "عدد الساعات": "hours", "hours": "hours",
        "إعداد": "prepared_by", "اعداد": "prepared_by", "prepared_by": "prepared_by",
        "المكان": "location", "location": "location",
        "المدرب": "trainer", "trainer": "trainer",
        "التدقيق": "audit_status", "audit": "audit_status",
      };
      const colMapping: (string | null)[] = headers.map(h => {
        for (const [key, val] of Object.entries(fieldMap)) {
          const normKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          if (h.includes(normKey)) return val;
        }
        return null;
      });
      let imported = 0, failed = 0;
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;
        const record: any = { created_by: user!.id, unit: "curriculum" };
        colMapping.forEach((field, j) => {
          if (!field || row[j] == null) return;
          const val = String(row[j]).trim();
          if (!val) return;
          if (field === "is_printed" || field === "is_applied") record[field] = ["نعم", "yes", "true", "1"].includes(val.toLowerCase());
          else if (field === "hours") record[field] = parseFloat(val) || null;
          else if (field === "form_type") record[field] = val.includes("قديم") || val.toLowerCase().includes("old") ? "old" : "new";
          else if (field === "powerpoint_status") record[field] = val.includes("قديم") || val.toLowerCase().includes("old") ? "old" : "new";
          else if (field === "audit_status") {
            if (val.includes("تم") && !val.includes("لم")) record[field] = "done";
            else if (val.includes("جاري")) record[field] = "in_progress";
            else record[field] = "not_started";
          }
          else record[field] = val;
        });
        if (record.title) {
          record.stage = computeStage(record);
          const { error } = await supabase.from("curricula").insert(record);
          if (error) failed++; else imported++;
        }
      }
      toast({ title: failed > 0 ? `تم استيراد ${imported} منهاج، فشل ${failed}` : `تم استيراد ${imported} منهاج بنجاح`, variant: failed > 0 ? "destructive" : "default" });
      fetchCurricula();
    } catch (err: any) {
      toast({ title: "خطأ في الاستيراد", description: err.message, variant: "destructive" });
    }
    if (excelInputRef.current) excelInputRef.current.value = "";
  };

  const stageDiagramData = stageFlow.map(stage => ({
    stage, label: stageLabels[stage],
    count: curricula.filter(c => c.stage === stage).length,
    color: stageColors[stage],
  }));

  const presentationsDiagramData = [
    { stage: "powerpoint", label: "بوربوينت", count: curricula.filter(c => c.powerpoint_status === "new").length, color: stageColors.powerpoint },
    { stage: "ppt_audit", label: "تدقيق", count: curricula.filter(c => c.audit_status === "in_progress").length, color: stageColors.audit },
    { stage: "ppt_done", label: "منجز", count: curricula.filter(c => c.audit_status === "done").length, color: stageColors.completed },
  ];

  const getPptFiltered = (stage: string) => {
    if (stage === "powerpoint") return curricula.filter(c => c.powerpoint_status === "new");
    if (stage === "ppt_audit") return curricula.filter(c => c.audit_status === "in_progress");
    if (stage === "ppt_done") return curricula.filter(c => c.audit_status === "done");
    return [];
  };

  const filteredByStage = selectedStage ? curricula.filter(c => c.stage === selectedStage) : [];

  // Shared form fields component
  const FormFields = ({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent) => void; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2"><Label>العنوان *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between p-3 border rounded-lg"><Label>مطبوع</Label><Switch checked={form.is_printed} onCheckedChange={(v) => setForm({ ...form, is_printed: v })} /></div>
        <div className="flex items-center justify-between p-3 border rounded-lg"><Label>مطبّق</Label><Switch checked={form.is_applied} onCheckedChange={(v) => setForm({ ...form, is_applied: v })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>فورمة</Label>
          <Select value={form.form_type} onValueChange={(v) => setForm({ ...form, form_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">جديدة</SelectItem><SelectItem value="old">قديمة</SelectItem></SelectContent></Select>
        </div>
        <div className="space-y-2"><Label>بوربوينت</Label>
          <Select value={form.powerpoint_status} onValueChange={(v) => setForm({ ...form, powerpoint_status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">جديد</SelectItem><SelectItem value="old">قديم</SelectItem></SelectContent></Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>الفئات المستهدفة</Label><Input value={form.target_groups} onChange={(e) => setForm({ ...form, target_groups: e.target.value })} /></div>
        <div className="space-y-2"><Label>عدد الفئة المستهدفة</Label><Input type="number" value={form.target_group_count} onChange={(e) => setForm({ ...form, target_group_count: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><Label>الأهداف</Label><Textarea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>الجهة المنفذة</Label>
          <Select value={form.executing_entity} onValueChange={(v) => setForm({ ...form, executing_entity: v, prepared_by: v === "internal" ? "" : form.prepared_by })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">داخلية</SelectItem><SelectItem value="external">خارجية</SelectItem></SelectContent></Select>
        </div>
        <div className="space-y-2"><Label>عدد الساعات</Label><Input type="number" step="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
      </div>
      <div className="space-y-2">
        <Label>إعداد {form.executing_entity === "internal" ? "(اختيار)" : "(كتابة)"}</Label>
        {form.executing_entity === "internal" ? (
          <Select value={form.prepared_by} onValueChange={(v) => setForm({ ...form, prepared_by: v })}><SelectTrigger><SelectValue placeholder="اختر المُعد" /></SelectTrigger><SelectContent>{profiles.map(p => (<SelectItem key={p.user_id} value={p.full_name}>{p.full_name}</SelectItem>))}</SelectContent></Select>
        ) : (<Input value={form.prepared_by} onChange={(e) => setForm({ ...form, prepared_by: e.target.value })} />)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>المكان</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        <div className="space-y-2"><Label>المدرب</Label><Input value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><Label>التدقيق</Label>
        <Select value={form.audit_status} onValueChange={(v) => setForm({ ...form, audit_status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="done">تم</SelectItem><SelectItem value="in_progress">جاري</SelectItem><SelectItem value="not_started">لم يتم</SelectItem></SelectContent></Select>
      </div>
      <Button type="submit" className="w-full gradient-primary text-white">{submitLabel}</Button>
    </form>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold font-cairo flex items-center gap-2"><BookOpen className="w-6 h-6 text-accent" />المناهج والعروض</h2>
            <p className="text-sm text-muted-foreground">إدارة المناهج التدريبية والعروض التقديمية</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant={viewMode === "curricula_diagram" ? "default" : "outline"} onClick={() => { setViewMode("curricula_diagram"); setSelectedStage(null); setPptFilterStage(null); }} className="gap-2"><Eye className="w-4 h-4" />عرض المناهج</Button>
            <Button variant={viewMode === "presentations_diagram" ? "default" : "outline"} onClick={() => { setViewMode("presentations_diagram"); setSelectedStage(null); setPptFilterStage(null); }} className="gap-2"><Eye className="w-4 h-4" />عرض العروض</Button>
            <Button variant={viewMode === "table" ? "default" : "outline"} onClick={() => { setViewMode("table"); setSelectedStage(null); setPptFilterStage(null); }} className="gap-2">عرض الجدول</Button>
            {(role === "admin" || role === "unit_head") && (
              <>
                <input ref={excelInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleExcelImport} />
                <Button variant="outline" onClick={() => excelInputRef.current?.click()} className="gap-2"><FileSpreadsheet className="w-4 h-4" />استيراد Excel</Button>
              </>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button className="gradient-primary text-white gap-2"><Plus className="w-4 h-4" />منهاج جديد</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-cairo">إضافة منهاج جديد</DialogTitle></DialogHeader>
                <FormFields onSubmit={handleCreate} submitLabel="إضافة المنهاج" />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Curricula Diagram */}
        {viewMode === "curricula_diagram" && !selectedStage && (
          <Card className="shadow-card border-0">
            <CardHeader><CardTitle className="text-base">مراحل إنجاز المناهج</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {stageDiagramData.map((s, i) => (
                  <div key={s.stage} className="flex items-center gap-2">
                    <button onClick={() => setSelectedStage(s.stage)} className="flex flex-col items-center p-4 rounded-xl border-2 hover:shadow-elevated transition-all min-w-[100px] cursor-pointer" style={{ borderColor: s.color, background: `${s.color}15` }}>
                      <span className="text-3xl font-bold" style={{ color: s.color }}>{s.count}</span>
                      <span className="text-sm font-medium mt-1">{s.label}</span>
                    </button>
                    {i < stageDiagramData.length - 1 && <ArrowLeft className="w-5 h-5 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Presentations Diagram - now clickable */}
        {viewMode === "presentations_diagram" && !pptFilterStage && (
          <Card className="shadow-card border-0">
            <CardHeader><CardTitle className="text-base">مراحل العروض التقديمية</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {presentationsDiagramData.map((s, i) => (
                  <div key={s.stage} className="flex items-center gap-2">
                    <button onClick={() => setPptFilterStage(s.stage)} className="flex flex-col items-center p-4 rounded-xl border-2 hover:shadow-elevated transition-all min-w-[100px] cursor-pointer" style={{ borderColor: s.color, background: `${s.color}15` }}>
                      <span className="text-3xl font-bold" style={{ color: s.color }}>{s.count}</span>
                      <span className="text-sm font-medium mt-1">{s.label}</span>
                    </button>
                    {i < presentationsDiagramData.length - 1 && <ArrowLeft className="w-5 h-5 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PPT drill-down */}
        {pptFilterStage && (
          <Card className="shadow-card border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">العروض في مرحلة: {presentationsDiagramData.find(p => p.stage === pptFilterStage)?.label}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setPptFilterStage(null)}>رجوع</Button>
              </div>
            </CardHeader>
            <CardContent>
              {getPptFiltered(pptFilterStage).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد عروض في هذه المرحلة</p>
              ) : (
                <div className="space-y-3">
                  {getPptFiltered(pptFilterStage).map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">بوربوينت: {c.powerpoint_status === "new" ? "جديد" : "قديم"} | التدقيق: {auditLabels[c.audit_status]}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="gap-1"><Pencil className="w-3 h-3" />تعديل</Button>
                        <Button size="sm" variant="outline" onClick={() => handleFileUpload(c.id)} className="gap-1"><Upload className="w-3 h-3" />رفع ملف</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stage drill-down */}
        {selectedStage && (
          <Card className="shadow-card border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">المناهج في مرحلة: {stageLabels[selectedStage]}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setSelectedStage(null)}>رجوع</Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredByStage.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد مناهج في هذه المرحلة</p>
              ) : (
                <div className="space-y-3">
                  {filteredByStage.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">التدقيق: {auditLabels[c.audit_status]} | الساعات: {c.hours ?? "—"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="gap-1"><Pencil className="w-3 h-3" />تعديل</Button>
                        {(c.audit_status === "done" || c.audit_status === "in_progress") && (
                          <Button size="sm" variant="outline" onClick={() => handleFileUpload(c.id)} className="gap-1"><Upload className="w-3 h-3" />رفع ملف</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Table view */}
        {viewMode === "table" && (
          <Card className="shadow-card border-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">المرحلة</TableHead>
                      <TableHead className="text-right">مطبوع</TableHead>
                      <TableHead className="text-right">فورمة</TableHead>
                      <TableHead className="text-right">بوربوينت</TableHead>
                      <TableHead className="text-right">مطبّق</TableHead>
                      <TableHead className="text-right">التدقيق</TableHead>
                      <TableHead className="text-right">الساعات</TableHead>
                      <TableHead className="text-right">المدرب</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {curricula.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد مناهج بعد</TableCell></TableRow>
                    ) : curricula.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell><Badge style={{ background: stageColors[c.stage], color: "white" }}>{stageLabels[c.stage]}</Badge></TableCell>
                        <TableCell>{c.is_printed ? "✓" : "✗"}</TableCell>
                        <TableCell>{c.form_type === "new" ? "جديدة" : "قديمة"}</TableCell>
                        <TableCell>{c.powerpoint_status === "new" ? "جديد" : "قديم"}</TableCell>
                        <TableCell>{c.is_applied ? "✓" : "✗"}</TableCell>
                        <TableCell>{auditLabels[c.audit_status] ?? "—"}</TableCell>
                        <TableCell>{c.hours ?? "—"}</TableCell>
                        <TableCell>{c.trainer ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="gap-1 h-7"><Pencil className="w-3 h-3" />تعديل</Button>
                            {(c.audit_status === "done" || c.audit_status === "in_progress") && (
                              <Button size="sm" variant="ghost" onClick={() => handleFileUpload(c.id)} className="gap-1 h-7"><Upload className="w-3 h-3" />رفع</Button>
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
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-cairo">تعديل المنهاج</DialogTitle></DialogHeader>
            <FormFields onSubmit={handleEdit} submitLabel="حفظ التعديلات" />
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
