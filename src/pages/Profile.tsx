import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User2, Phone, Shield, Clock } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, role, fullName } = useAuth();
  const [phone, setPhone] = useState("");
  const [dutySystem, setDutySystem] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

  const roleLabels: Record<string, string> = {
    admin: "مدير القسم",
    unit_head: "مسؤول الشعبة",
    individual: "موظف / فرد",
  };
  const dutyLabels: Record<string, string> = {
    daily: "يومي",
    shift_77: "بديل 7/7",
    shift_1515: "بديل 15/15",
  };
  const unitLabels: Record<string, string> = {
    preparation: "شعبة الإعداد",
    curriculum: "شعبة المناهج",
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("phone, duty_system, unit")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPhone(data.phone ?? "");
          setDutySystem(data.duty_system ?? "");
          setUnit(data.unit ?? "");
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("حدث خطأ أثناء الحفظ");
    } else {
      toast.success("تم حفظ البيانات بنجاح");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-xl font-bold font-cairo">حسابي</h2>

        <Card className="shadow-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User2 className="w-5 h-5 text-primary" />
              المعلومات الشخصية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">الاسم الكامل</Label>
                <p className="font-medium mt-1">{fullName ?? "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">البريد الإلكتروني</Label>
                <p className="font-medium mt-1 text-left dir-ltr">{user?.email ?? "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" /> الصلاحية
                </Label>
                <p className="font-medium mt-1">{role ? roleLabels[role] : "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> نظام الدوام
                </Label>
                <p className="font-medium mt-1">{dutyLabels[dutySystem] ?? "—"}</p>
              </div>
              {unit && (
                <div>
                  <Label className="text-xs text-muted-foreground">الشعبة</Label>
                  <p className="font-medium mt-1">{unitLabels[unit] ?? unit}</p>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <Label htmlFor="phone" className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" /> رقم الجوال
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="max-w-xs"
                  dir="ltr"
                />
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? "جارٍ الحفظ..." : "حفظ"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
