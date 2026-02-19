import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/AppSidebar"; // لاحظ المسار الذي وضعته فيه
import { useAuth } from "@/hooks/useAuth";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full" dir="rtl">
        {/* استدعاء القائمة الجانبية الجديدة */}
        <AppSidebar /> 

        <main className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
          <header className="h-14 border-b flex items-center px-4 bg-card/50 backdrop-blur-sm shrink-0">
            <SidebarTrigger />
            <div className="mr-4 text-sm font-bold text-muted-foreground font-cairo">
              نظام إدارة التدريب
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
