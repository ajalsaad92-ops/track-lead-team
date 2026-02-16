export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      curricula: {
        Row: {
          audit_status: Database["public"]["Enums"]["audit_status"]
          created_at: string
          created_by: string | null
          executing_entity: string | null
          file_urls: Json | null
          form_type: string
          hours: number | null
          id: string
          is_applied: boolean
          is_printed: boolean
          location: string | null
          objectives: string | null
          powerpoint_status: string
          prepared_by: string | null
          stage: Database["public"]["Enums"]["curriculum_stage"]
          target_groups: string | null
          title: string
          trainer: string | null
          unit: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          audit_status?: Database["public"]["Enums"]["audit_status"]
          created_at?: string
          created_by?: string | null
          executing_entity?: string | null
          file_urls?: Json | null
          form_type?: string
          hours?: number | null
          id?: string
          is_applied?: boolean
          is_printed?: boolean
          location?: string | null
          objectives?: string | null
          powerpoint_status?: string
          prepared_by?: string | null
          stage?: Database["public"]["Enums"]["curriculum_stage"]
          target_groups?: string | null
          title: string
          trainer?: string | null
          unit?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          audit_status?: Database["public"]["Enums"]["audit_status"]
          created_at?: string
          created_by?: string | null
          executing_entity?: string | null
          file_urls?: Json | null
          form_type?: string
          hours?: number | null
          id?: string
          is_applied?: boolean
          is_printed?: boolean
          location?: string | null
          objectives?: string | null
          powerpoint_status?: string
          prepared_by?: string | null
          stage?: Database["public"]["Enums"]["curriculum_stage"]
          target_groups?: string | null
          title?: string
          trainer?: string | null
          unit?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          created_at: string
          id: string
          leave_days_total: number
          leave_days_used: number
          month: string
          time_off_hours_total: number
          time_off_hours_used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leave_days_total?: number
          leave_days_used?: number
          month: string
          time_off_hours_total?: number
          time_off_hours_used?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leave_days_total?: number
          leave_days_used?: number
          month?: string
          time_off_hours_total?: number
          time_off_hours_used?: number
          user_id?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          admin_date: string | null
          admin_decision: Database["public"]["Enums"]["approval_status"] | null
          admin_id: string | null
          admin_notes: string | null
          created_at: string
          end_date: string | null
          hours: number | null
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["approval_status"]
          unit_head_date: string | null
          unit_head_decision:
            | Database["public"]["Enums"]["approval_status"]
            | null
          unit_head_id: string | null
          unit_head_notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_date?: string | null
          admin_decision?: Database["public"]["Enums"]["approval_status"] | null
          admin_id?: string | null
          admin_notes?: string | null
          created_at?: string
          end_date?: string | null
          hours?: number | null
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["approval_status"]
          unit_head_date?: string | null
          unit_head_decision?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          unit_head_id?: string | null
          unit_head_notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_date?: string | null
          admin_decision?: Database["public"]["Enums"]["approval_status"] | null
          admin_id?: string | null
          admin_notes?: string | null
          created_at?: string
          end_date?: string | null
          hours?: number | null
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["approval_status"]
          unit_head_date?: string | null
          unit_head_decision?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          unit_head_id?: string | null
          unit_head_notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          duty_system: Database["public"]["Enums"]["duty_system"]
          full_name: string
          id: string
          phone: string | null
          unit: Database["public"]["Enums"]["unit_type"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duty_system?: Database["public"]["Enums"]["duty_system"]
          full_name: string
          id?: string
          phone?: string | null
          unit?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duty_system?: Database["public"]["Enums"]["duty_system"]
          full_name?: string
          id?: string
          phone?: string | null
          unit?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string
          completion_notes: string | null
          created_at: string
          curriculum_id: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          points_awarded: number | null
          review_notes: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          unit: Database["public"]["Enums"]["unit_type"] | null
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to: string
          completion_notes?: string | null
          created_at?: string
          curriculum_id?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          points_awarded?: number | null
          review_notes?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title: string
          unit?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string
          completion_notes?: string | null
          created_at?: string
          curriculum_id?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          points_awarded?: number | null
          review_notes?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          unit?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          unit: Database["public"]["Enums"]["unit_type"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          unit?: Database["public"]["Enums"]["unit_type"] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          unit?: Database["public"]["Enums"]["unit_type"] | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_profile_unit: {
        Args: { _profile_user_id: string }
        Returns: Database["public"]["Enums"]["unit_type"]
      }
      get_user_unit: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["unit_type"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_unit_head_of: {
        Args: {
          _unit: Database["public"]["Enums"]["unit_type"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "unit_head" | "individual"
      approval_status:
        | "pending"
        | "unit_head_approved"
        | "unit_head_rejected"
        | "admin_approved"
        | "admin_rejected"
      attendance_status: "present" | "leave" | "time_off" | "duty" | "absent"
      audit_status: "done" | "in_progress" | "not_started"
      curriculum_stage:
        | "printed"
        | "form"
        | "powerpoint"
        | "application"
        | "objectives"
        | "audit"
        | "completed"
      duty_system: "daily" | "shift_77" | "shift_1515"
      leave_type: "leave" | "time_off"
      task_status:
        | "assigned"
        | "in_progress"
        | "completed"
        | "under_review"
        | "approved"
        | "suspended"
      task_type: "curriculum_task" | "regular_task"
      unit_type: "preparation" | "curriculum"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "unit_head", "individual"],
      approval_status: [
        "pending",
        "unit_head_approved",
        "unit_head_rejected",
        "admin_approved",
        "admin_rejected",
      ],
      attendance_status: ["present", "leave", "time_off", "duty", "absent"],
      audit_status: ["done", "in_progress", "not_started"],
      curriculum_stage: [
        "printed",
        "form",
        "powerpoint",
        "application",
        "objectives",
        "audit",
        "completed",
      ],
      duty_system: ["daily", "shift_77", "shift_1515"],
      leave_type: ["leave", "time_off"],
      task_status: [
        "assigned",
        "in_progress",
        "completed",
        "under_review",
        "approved",
        "suspended",
      ],
      task_type: ["curriculum_task", "regular_task"],
      unit_type: ["preparation", "curriculum"],
    },
  },
} as const
