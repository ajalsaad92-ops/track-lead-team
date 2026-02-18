import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, CalendarDays, BookOpen, ClipboardList,
  BarChart3, Shield, LogOut, Menu, X, ChevronLeft } from
"lucide-react";
import { cn } from "@/lib/utils";

const roleLabels: Record<string, string> = {
  admin: "مدير القسم",
  unit_head: "مسؤول شعبة",
  individual: "فرد"
};

interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}

const navItems: NavItem[] = [
{ label: "لوحة القيادة", path: "/dashboard", icon: LayoutDashboard },
{ label: "إدارة المستخدمين", path: "/users", icon: Users, roles: ["admin"] },
{ label: "الموارد البشرية", path: "/hr", icon: CalendarDays },
{ label: "المناهج والعروض", path: "/curricula", icon: BookOpen, roles: ["admin", "unit_head", "individual"] },
{ label: "المهام", path: "/tasks", icon: ClipboardList },
{ label: "التقارير", path: "/reports", icon: BarChart3, roles: ["admin", "unit_head"] }];


export default function AppLayout({ children }: {children: ReactNode;}) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNav = navItems.filter(
    (item) => !item.roles || role && item.roles.includes(role)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen &&
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={() => setSidebarOpen(false)} />

      }

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 right-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}>

        {/* Sidebar Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold font-cairo">نظام التدريب</h1>
                <p className="text-xs text-sidebar-foreground/60 font-serif">
                  {roleLabels[role ?? ""] ?? ""}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}>

              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive ?
                  "bg-sidebar-primary text-sidebar-primary-foreground" :
                  "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}>

                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
                {isActive && <ChevronLeft className="w-4 h-4 mr-auto" />}
              </button>);

          })}
        </nav>

        {/* User Info */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground shrink-0 h-8 w-8">

              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar (mobile) */}
        <header className="lg:hidden gradient-primary text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="font-bold text-sm font-cairo">نظام التدريب</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-white hover:bg-white/20">

            <Menu className="w-5 h-5" />
          </Button>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>);

}