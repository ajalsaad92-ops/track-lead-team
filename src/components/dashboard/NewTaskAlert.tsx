import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface NewTaskAlertProps {
  title: string;
  onDismiss: () => void;
}

export default function NewTaskAlert({ title, onDismiss }: NewTaskAlertProps) {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-xl border-2 border-warning/40 bg-warning/10 p-4">
      {/* Pulsing indicator */}
      <span className="absolute top-3 left-3 flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-warning" />
      </span>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">مهمة جديدة وردت إليك!</p>
          <p className="text-xs text-muted-foreground truncate">{title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate("/tasks")}>
            عرض
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDismiss}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
