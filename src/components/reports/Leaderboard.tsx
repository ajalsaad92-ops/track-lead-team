import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, Trophy, Medal } from "lucide-react";

interface LeaderEntry {
  user_id: string;
  full_name: string;
  unit: string;
  points: number;
}

const unitLabels: Record<string, string> = { preparation: "شعبة الإعداد", curriculum: "شعبة المناهج" };

const medalColors = ["text-yellow-500", "text-gray-400", "text-amber-700"];

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchLeaderboard(); }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    const [profilesRes, tasksRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, unit"),
      supabase.from("tasks").select("assigned_to, points_awarded").eq("status", "approved"),
    ]);

    const profiles = profilesRes.data ?? [];
    const tasks = tasksRes.data ?? [];

    const leaderboard: LeaderEntry[] = profiles.map(p => ({
      user_id: p.user_id,
      full_name: p.full_name,
      unit: p.unit ?? "",
      points: tasks.filter(t => t.assigned_to === p.user_id).reduce((s, t) => s + (t.points_awarded || 0), 0),
    })).sort((a, b) => b.points - a.points);

    setEntries(leaderboard);
    setLoading(false);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><title>لوحة التميز</title>
      <style>
        body { font-family: 'Cairo', sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 12px; }
        th { background: #f0f0f0; }
        h1 { font-size: 18px; text-align: center; }
      </style></head><body>
      <h1>لوحة التميز — ترتيب الموظفين</h1>
      <p style="text-align:center;color:#666;font-size:12px;">التاريخ: ${new Date().toLocaleDateString("ar-SA")}</p>
      ${printContent.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" />طباعة
        </Button>
      </div>

      {/* Top 3 Cards */}
      {entries.length >= 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {entries.slice(0, 3).map((e, i) => (
            <Card key={e.user_id} className={`shadow-card border-0 ${i === 0 ? "ring-2 ring-yellow-400" : ""}`}>
              <CardContent className="p-4 text-center">
                <Trophy className={`w-8 h-8 mx-auto ${medalColors[i] ?? "text-muted-foreground"}`} />
                <p className="font-bold mt-2">{e.full_name}</p>
                <p className="text-xs text-muted-foreground">{unitLabels[e.unit] ?? "—"}</p>
                <p className="text-2xl font-bold text-primary mt-1">{e.points} نقطة</p>
                <Badge className="mt-1">{i === 0 ? "🥇 ذهبي" : i === 1 ? "🥈 فضي" : "🥉 برونزي"}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="shadow-card border-0">
        <CardContent className="p-0" ref={printRef}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الترتيب</TableHead>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الشعبة</TableHead>
                <TableHead className="text-right">النقاط</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e, i) => (
                <TableRow key={e.user_id} className={i < 3 ? "bg-primary/5" : ""}>
                  <TableCell className="font-bold">
                    {i < 3 ? (
                      <span className={medalColors[i]}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                    ) : (
                      i + 1
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{e.full_name}</TableCell>
                  <TableCell>{unitLabels[e.unit] ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className="bg-success/10 text-success">{e.points}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
