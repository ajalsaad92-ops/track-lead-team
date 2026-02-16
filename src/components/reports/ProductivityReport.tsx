import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const unitLabels: Record<string, string> = { preparation: "شعبة الإعداد", curriculum: "شعبة المناهج" };

interface UnitStats {
  unit: string;
  completedTasks: number;
  overdueTasks: number;
  completedCurricula: number;
  totalTasks: number;
}

export default function ProductivityReport() {
  const [stats, setStats] = useState<UnitStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    const now = new Date();

    const [tasksRes, currRes] = await Promise.all([
      supabase.from("tasks").select("unit, status, due_date"),
      supabase.from("curricula").select("unit, stage"),
    ]);

    const tasks = tasksRes.data ?? [];
    const curricula = currRes.data ?? [];

    const units = ["preparation", "curriculum"];
    const result: UnitStats[] = units.map(u => {
      const unitTasks = tasks.filter(t => t.unit === u);
      const completed = unitTasks.filter(t => ["approved", "completed"].includes(t.status)).length;
      const overdue = unitTasks.filter(t => t.due_date && new Date(t.due_date) < now && !["approved", "completed"].includes(t.status)).length;
      const completedCur = curricula.filter(c => c.unit === u && c.stage === "completed").length;
      return {
        unit: u,
        completedTasks: completed,
        overdueTasks: overdue,
        completedCurricula: completedCur,
        totalTasks: unitTasks.length,
      };
    });
    setStats(result);
    setLoading(false);
  };

  const chartData = stats.map(s => ({
    name: unitLabels[s.unit] ?? s.unit,
    "مهام منجزة": s.completedTasks,
    "مهام متأخرة": s.overdueTasks,
    "مناهج مكتملة": s.completedCurricula,
  }));

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="text-sm font-cairo">مقارنة إنتاجية الشعب</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="مهام منجزة" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="مهام متأخرة" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="مناهج مكتملة" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-card border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الشعبة</TableHead>
                <TableHead className="text-right">إجمالي المهام</TableHead>
                <TableHead className="text-right">مهام منجزة</TableHead>
                <TableHead className="text-right">مهام متأخرة</TableHead>
                <TableHead className="text-right">مناهج مكتملة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map(s => (
                <TableRow key={s.unit}>
                  <TableCell className="font-medium">{unitLabels[s.unit]}</TableCell>
                  <TableCell>{s.totalTasks}</TableCell>
                  <TableCell className="text-success font-medium">{s.completedTasks}</TableCell>
                  <TableCell className="text-destructive font-medium">{s.overdueTasks}</TableCell>
                  <TableCell>{s.completedCurricula}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
