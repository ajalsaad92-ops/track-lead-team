import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Trophy, TrendingUp } from "lucide-react";
import AttendanceReport from "@/components/reports/AttendanceReport";
import ProductivityReport from "@/components/reports/ProductivityReport";
import Leaderboard from "@/components/reports/Leaderboard";

export default function ReportsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold font-cairo flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            التقارير
          </h2>
          <p className="text-sm text-muted-foreground">تقارير شاملة للحضور والإنتاجية ولوحة التميز</p>
        </div>

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList>
            <TabsTrigger value="attendance" className="gap-1"><BarChart3 className="w-4 h-4" />الحضور والانضباط</TabsTrigger>
            <TabsTrigger value="productivity" className="gap-1"><TrendingUp className="w-4 h-4" />إنتاجية الشعب</TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-1"><Trophy className="w-4 h-4" />لوحة التميز</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance">
            <AttendanceReport />
          </TabsContent>
          <TabsContent value="productivity">
            <ProductivityReport />
          </TabsContent>
          <TabsContent value="leaderboard">
            <Leaderboard />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
