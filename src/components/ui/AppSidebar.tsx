import { 
  User2, LogOut, LayoutDashboard, ClipboardList, 
  BookOpen, Users, ChevronUp, CalendarDays, BarChart3
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"; // تأكد من المسار الصحيح للملف الذي أرسلته
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

export function AppSidebar() {
  const { fullName, role, signOut } = useAuth();
  const navigate = useNavigate();

  const roleTranslations: Record<string, string> = {
    admin: "مدير القسم",
    unit_head: "مسؤول الشعبة",
    individual: "موظف / فرد",
  };

  return (
    <Sidebar collapsible="icon" side="right">
      {/* 1. رأس القائمة - عرض الشعار أو اسم النظام */}
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold">T</div>
          <span className="font-bold truncate group-data-[collapsible=icon]:hidden">نظام إدارة التدريب</span>
        </div>
      </SidebarHeader>

      {/* 2. محتوى القائمة - الروابط */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">القائمة الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigate("/")} tooltip="لوحة القيادة">
                  <LayoutDashboard />
                  <span>لوحة القيادة</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigate("/tasks")} tooltip="المهام">
                  <ClipboardList />
                  <span>المهام</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigate("/curricula")} tooltip="المناهج والعروض">
                   <BookOpen />
                   <span>المناهج والعروض</span>
                 </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigate("/hr")} tooltip="الموارد البشرية">
                  <CalendarDays />
                  <span>الموارد البشرية</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {(role === "admin" || role === "unit_head") && (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate("/reports")} tooltip="التقارير">
                    <BarChart3 />
                    <span>التقارير</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {role === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate("/users")} tooltip="المستخدمين">
                    <Users />
                    <span>إدارة المستخدمين</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* 3. تذييل القائمة - هنا يظهر اسم الفرد والرتبة بشكل احترافي */}
      <SidebarFooter className="p-2 border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                      <User2 className="w-5 h-5 text-secondary" />
                    </div>
                    <div className="flex flex-col text-right truncate group-data-[collapsible=icon]:hidden">
                      <span className="text-sm font-bold truncate leading-none mb-1">{fullName || "تحميل..."}</span>
                      <span className="text-[10px] text-muted-foreground">{role ? roleTranslations[role] : "---"}</span>
                    </div>
                  </div>
                  <ChevronUp className="w-4 h-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/profile")}>حسابي</DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                  <LogOut className="ml-2 w-4 h-4" /> تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
