import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { loading } = useAuth();

  // إذا كان النظام لا يزال يتأكد من هوية المستخدم، نظهر شاشة تحميل بسيطة
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      {/* dir="rtl" لضمان أن البرنامج بالكامل يبدأ من اليمين لليسار */}
      <div className="flex h-screen w-full" dir="rtl">
        
        {/* هذه هي القائمة الجانبية الجديدة التي ستعرض الاسم والرتبة */}
        <AppSidebar /> 

        <main className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
          {/* شريط علوي بسيط يحتوي على زر فتح/غلق القائمة */}
          <header className="h-14 border-b flex items-center px-4 bg-card/50 backdrop-blur-sm shrink-0">
            <SidebarTrigger />
            <div className="mr-4 text-sm font-bold text-muted-foreground">
              نظام إدارة التدريب الذكي
            </div>
          </header>

          {/* مساحة عرض المحتوى (المهام، المناهج، إلخ) */}
          <div className="flex-1 overflow-auto p-4 lg:p-6 content-area">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
