import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Pencil, KeyRound, History, ShieldOff, ShieldCheck } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useIsMobile } from "@/hooks/use-mobile";

const roleLabels: Record<string, string> = { admin: "مدير", unit_head: "مسؤول شعبة", individual: "فرد" };
const unitLabels: Record<string, string> = { preparation: "شعبة الإعداد", curriculum: "شعبة المناهج" };
const dutyLabels: Record<string, string> = { daily: "يومي", shift_77: "بديل 77", shift_1515: "بديل 1515" };

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  unit: string | null;
  duty_system: string;
  phone: string | null;
  is_disabled: boolean;
  user_roles: { role: string; unit: string | null }[];
}

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", unit: "", duty_system: "", phone: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [highlightUserId, setHighlightUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", role: "individual",
    unit: "preparation", duty_system: "daily", phone: "",
  });

  const fetchProfiles = async () => {
    // Fetch profiles and roles separately to avoid foreign key issue
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role, unit"),
    ]);

    const rolesMap: Record<string, { role: string; unit: string | null }[]> = {};
    (rolesRes.data ?? []).forEach((r: any) => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push({ role: r.role, unit: r.unit });
    });

    const merged = (profilesRes.data ?? []).map((p: any) => ({
      ...p,
      user_roles: rolesMap[p.user_id] ?? [],
    }));

    setProfiles(merged as Profile[]);
    setLoading(false);
  };

  const fetchAuditLogs = async () => {
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setAuditLogs(data ?? []);
  };

  useEffect(() => { fetchProfiles(); fetchAuditLogs(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", { body: form });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "تم إنشاء الحساب بنجاح" });
      setDialogOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "individual", unit: "preparation", duty_system: "daily", phone: "" });
      await fetchProfiles();
      fetchAuditLogs();
      if (data?.user_id) {
        setHighlightUserId(data.user_id);
        setTimeout(() => setHighlightUserId(null), 4000);
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setCreating(false);
  };

  const openEdit = (p: Profile) => {
    setEditProfile(p);
    setEditForm({
      full_name: p.full_name,
      unit: p.unit ?? "preparation",
      duty_system: p.duty_system,
      phone: p.phone ?? "",
      role: p.user_roles?.[0]?.role ?? "individual",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProfile) return;
    setSaving(true);
    try {
      const { error: profileError } = await supabase.from("profiles").update({
        full_name: editForm.full_name,
        unit: editForm.unit as any,
        duty_system: editForm.duty_system as any,
        phone: editForm.phone || null,
      }).eq("user_id", editProfile.user_id);
      if (profileError) throw profileError;

      const currentRole = editProfile.user_roles?.[0]?.role;
      if (currentRole !== editForm.role) {
        await supabase.from("user_roles").update({
          role: editForm.role as any,
          unit: editForm.role === "unit_head" ? editForm.unit as any : null,
        }).eq("user_id", editProfile.user_id);
      }

      await supabase.from("audit_log").insert({
        user_id: user!.id,
        action: "update_user",
        target_type: "user",
        target_id: editProfile.user_id,
        details: { changes: editForm },
      });

      toast({ title: "تم تحديث البيانات" });
      setEditDialogOpen(false);
      fetchProfiles();
      fetchAuditLogs();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id: resetUserId, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "تم إعادة تعيين كلمة المرور" });
      setResetDialogOpen(false);
      setNewPassword("");
      fetchAuditLogs();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setResetting(false);
  };

  const handleToggleDisable = async (p: Profile) => {
    const newValue = !p.is_disabled;
    const { error } = await supabase.from("profiles").update({ is_disabled: newValue } as any).eq("user_id", p.user_id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("audit_log").insert({
      user_id: user!.id,
      action: newValue ? "disable_user" : "enable_user",
      target_type: "user",
      target_id: p.user_id,
      details: { full_name: p.full_name },
    });
    toast({ title: newValue ? "تم تعطيل الحساب" : "تم تفعيل الحساب" });
    fetchProfiles();
    fetchAuditLogs();
  };

  const actionLabels: Record<string, string> = {
    create_user: "إنشاء مستخدم", update_user: "تعديل بيانات", reset_password: "إعادة تعيين كلمة مرور",
    approve_leave: "موافقة على إجازة", reject_leave: "رفض إجازة",
    disable_user: "تعطيل حساب", enable_user: "تفعيل حساب",
  };

  const renderUserCard = (p: Profile) => (
    <Card
      key={p.id}
      className={`shadow-card border-0 ${highlightUserId === p.user_id ? "ring-2 ring-primary animate-pulse" : ""}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">{p.full_name}</h3>
          {p.is_disabled ? (
            <Badge variant="destructive" className="text-xs">معطّل</Badge>
          ) : (
            <Badge className="bg-success/10 text-success text-xs">نشط</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={p.user_roles?.[0]?.role === "admin" ? "default" : "secondary"}>
            {roleLabels[p.user_roles?.[0]?.role ?? ""] ?? "—"}
          </Badge>
          <Badge variant="outline">{unitLabels[p.unit ?? ""] ?? "—"}</Badge>
          <Badge variant="outline">{dutyLabels[p.duty_system] ?? "—"}</Badge>
        </div>
        {p.phone && <p className="text-xs text-muted-foreground" dir="ltr">{p.phone}</p>}
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 h-8 gap-1 text-xs" onClick={() => openEdit(p)}>
            <Pencil className="w-3 h-3" />تعديل
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-8 gap-1 text-xs" onClick={() => { setResetUserId(p.user_id); setResetDialogOpen(true); }}>
            <KeyRound className="w-3 h-3" />كلمة مرور
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={`h-8 gap-1 text-xs ${p.is_disabled ? "text-success" : "text-destructive"}`}
            onClick={() => handleToggleDisable(p)}
          >
            {p.is_disabled ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
            {p.is_disabled ? "تفعيل" : "تعطيل"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-cairo flex items-center gap-2">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              إدارة المستخدمين
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">إنشاء وإدارة حسابات الأفراد والمسؤولين</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-white gap-2 w-full sm:w-auto">
                <UserPlus className="w-4 h-4" />حساب جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-cairo">إنشاء حساب جديد</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>الاسم الكامل</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>كلمة المرور</Label>
                  <Input type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>الدور</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">مدير القسم</SelectItem>
                        <SelectItem value="unit_head">مسؤول شعبة</SelectItem>
                        <SelectItem value="individual">فرد</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الشعبة</Label>
                    <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preparation">شعبة الإعداد</SelectItem>
                        <SelectItem value="curriculum">شعبة المناهج</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>نظام الدوام</Label>
                    <Select value={form.duty_system} onValueChange={(v) => setForm({ ...form, duty_system: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">يومي</SelectItem>
                        <SelectItem value="shift_77">بديل 77</SelectItem>
                        <SelectItem value="shift_1515">بديل 1515</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الهاتف</Label>
                    <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" className="w-full gradient-primary text-white" disabled={creating}>
                  {creating ? "جاري الإنشاء..." : "إنشاء الحساب"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList>
            <TabsTrigger value="users">الأعضاء</TabsTrigger>
            <TabsTrigger value="audit" className="gap-1"><History className="w-4 h-4" />سجل النشاط</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>
            ) : profiles.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">لا يوجد مستخدمون بعد</p>
            ) : isMobile ? (
              <div className="space-y-3">
                {profiles.map(renderUserCard)}
              </div>
            ) : (
              <Card className="shadow-card border-0">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الاسم</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">الدور</TableHead>
                        <TableHead className="text-right">الشعبة</TableHead>
                        <TableHead className="text-right">نظام الدوام</TableHead>
                        <TableHead className="text-right">الهاتف</TableHead>
                        <TableHead className="text-right">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((p) => (
                        <TableRow
                          key={p.id}
                          className={highlightUserId === p.user_id ? "bg-primary/10 animate-pulse transition-colors duration-1000" : ""}
                        >
                          <TableCell className="font-medium">{p.full_name}</TableCell>
                          <TableCell>
                            {p.is_disabled ? (
                              <Badge variant="destructive" className="text-xs">معطّل</Badge>
                            ) : (
                              <Badge className="bg-success/10 text-success text-xs">نشط</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.user_roles?.[0]?.role === "admin" ? "default" : "secondary"}>
                              {roleLabels[p.user_roles?.[0]?.role ?? ""] ?? "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>{unitLabels[p.unit ?? ""] ?? "—"}</TableCell>
                          <TableCell>{dutyLabels[p.duty_system] ?? "—"}</TableCell>
                          <TableCell dir="ltr">{p.phone ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => openEdit(p)}>
                                <Pencil className="w-3 h-3" />تعديل
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => { setResetUserId(p.user_id); setResetDialogOpen(true); }}>
                                <KeyRound className="w-3 h-3" />كلمة مرور
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-7 gap-1 ${p.is_disabled ? "text-success" : "text-destructive"}`}
                                onClick={() => handleToggleDisable(p)}
                              >
                                {p.is_disabled ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                                {p.is_disabled ? "تفعيل" : "تعطيل"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="audit">
            <Card className="shadow-card border-0">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الإجراء</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">التفاصيل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا يوجد سجلات</TableCell></TableRow>
                    ) : auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{actionLabels[log.action] ?? log.action}</TableCell>
                        <TableCell><Badge variant="outline">{log.target_type ?? "—"}</Badge></TableCell>
                        <TableCell className="text-sm">{new Date(log.created_at).toLocaleString("ar-SA")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.details ? JSON.stringify(log.details).slice(0, 80) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-cairo">تعديل بيانات العضو</DialogTitle></DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الدور</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">مدير</SelectItem>
                      <SelectItem value="unit_head">مسؤول شعبة</SelectItem>
                      <SelectItem value="individual">فرد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الشعبة</Label>
                  <Select value={editForm.unit} onValueChange={(v) => setEditForm({ ...editForm, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preparation">شعبة الإعداد</SelectItem>
                      <SelectItem value="curriculum">شعبة المناهج</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>نظام الدوام</Label>
                  <Select value={editForm.duty_system} onValueChange={(v) => setEditForm({ ...editForm, duty_system: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="shift_77">بديل 77</SelectItem>
                      <SelectItem value="shift_1515">بديل 1515</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الهاتف</Label>
                  <Input dir="ltr" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary text-white" disabled={saving}>
                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="font-cairo">إعادة تعيين كلمة المرور</DialogTitle></DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label>كلمة المرور الجديدة</Label>
                <Input type="password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full gradient-primary text-white" disabled={resetting}>
                {resetting ? "جاري التعيين..." : "تعيين كلمة المرور"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
