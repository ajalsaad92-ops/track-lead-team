import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that subscribes to realtime changes on dashboard-relevant tables
 * and triggers a refetch callback. Also tracks new tasks for visual alerts.
 */
export function useDashboardRealtime(onRefresh: () => void) {
  const [newTaskAlert, setNewTaskAlert] = useState<{ id: string; title: string } | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const dismissAlert = useCallback(() => {
    setNewTaskAlert(null);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        onRefresh();
        if (payload.eventType === "INSERT") {
          const task = payload.new as { id: string; title: string };
          setNewTaskAlert({ id: task.id, title: task.title });
          // Auto-dismiss after 10 seconds
          if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
          alertTimeoutRef.current = setTimeout(() => setNewTaskAlert(null), 10000);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => {
        onRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
        onRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "curricula" }, () => {
        onRefresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, [onRefresh]);

  return { newTaskAlert, dismissAlert };
}
