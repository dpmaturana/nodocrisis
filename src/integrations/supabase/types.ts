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
      actor_capabilities: {
        Row: {
          availability: Database["public"]["Enums"]["availability_status"]
          capacity_type_id: string
          created_at: string
          id: string
          notes: string | null
          quantity: number | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability_status"]
          capacity_type_id: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability_status"]
          capacity_type_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actor_capabilities_capacity_type_id_fkey"
            columns: ["capacity_type_id"]
            isOneToOne: false
            referencedRelation: "capacity_types"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_types: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      country_news_sources: {
        Row: {
          country_code: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          rss_url: string
          source_name: string
        }
        Insert: {
          country_code: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          rss_url: string
          source_name: string
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          rss_url?: string
          source_name?: string
        }
        Relationships: []
      }
      deployments: {
        Row: {
          actor_id: string
          capacity_type_id: string
          created_at: string
          event_id: string
          id: string
          notes: string | null
          sector_id: string
          status: Database["public"]["Enums"]["deployment_status"]
          updated_at: string
          verified: boolean | null
        }
        Insert: {
          actor_id: string
          capacity_type_id: string
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          sector_id: string
          status?: Database["public"]["Enums"]["deployment_status"]
          updated_at?: string
          verified?: boolean | null
        }
        Update: {
          actor_id?: string
          capacity_type_id?: string
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          sector_id?: string
          status?: Database["public"]["Enums"]["deployment_status"]
          updated_at?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "deployments_capacity_type_id_fkey"
            columns: ["capacity_type_id"]
            isOneToOne: false
            referencedRelation: "capacity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_context_needs: {
        Row: {
          capacity_type_id: string
          created_at: string
          created_by: string | null
          event_id: string
          expires_at: string | null
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["event_priority"]
          source_type: string
        }
        Insert: {
          capacity_type_id: string
          created_at?: string
          created_by?: string | null
          event_id: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["event_priority"]
          source_type: string
        }
        Update: {
          capacity_type_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["event_priority"]
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_context_needs_capacity_type_id_fkey"
            columns: ["capacity_type_id"]
            isOneToOne: false
            referencedRelation: "capacity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_context_needs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ended_at: string | null
          id: string
          location: string | null
          name: string
          started_at: string
          status: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          location?: string | null
          name: string
          started_at?: string
          status?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          location?: string | null
          name?: string
          started_at?: string
          status?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      field_reports: {
        Row: {
          actor_id: string
          audio_url: string
          created_at: string
          error_message: string | null
          event_id: string
          extracted_data: Json | null
          id: string
          sector_id: string
          status: string
          text_note: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          actor_id: string
          audio_url: string
          created_at?: string
          error_message?: string | null
          event_id: string
          extracted_data?: Json | null
          id?: string
          sector_id: string
          status?: string
          text_note?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string
          audio_url?: string
          created_at?: string
          error_message?: string | null
          event_id?: string
          extracted_data?: Json | null
          id?: string
          sector_id?: string
          status?: string
          text_note?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_reports_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      initial_situation_reports: {
        Row: {
          created_at: string
          created_by: string | null
          event_name_suggested: string | null
          event_type: string | null
          id: string
          input_text: string
          linked_event_id: string | null
          overall_confidence: number | null
          sources: Json | null
          status: Database["public"]["Enums"]["report_status"]
          suggested_capabilities: Json | null
          suggested_sectors: Json | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_name_suggested?: string | null
          event_type?: string | null
          id?: string
          input_text: string
          linked_event_id?: string | null
          overall_confidence?: number | null
          sources?: Json | null
          status?: Database["public"]["Enums"]["report_status"]
          suggested_capabilities?: Json | null
          suggested_sectors?: Json | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_name_suggested?: string | null
          event_type?: string | null
          id?: string
          input_text?: string
          linked_event_id?: string | null
          overall_confidence?: number | null
          sources?: Json | null
          status?: Database["public"]["Enums"]["report_status"]
          suggested_capabilities?: Json | null
          suggested_sectors?: Json | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "initial_situation_reports_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_name: string | null
          organization_type: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_name?: string | null
          organization_type?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_name?: string | null
          organization_type?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sector_needs_context: {
        Row: {
          capacity_type_id: string
          created_at: string
          created_by: string | null
          event_id: string
          expires_at: string | null
          id: string
          level: Database["public"]["Enums"]["need_level"]
          notes: string | null
          sector_id: string
          source: string
        }
        Insert: {
          capacity_type_id: string
          created_at?: string
          created_by?: string | null
          event_id: string
          expires_at?: string | null
          id?: string
          level?: Database["public"]["Enums"]["need_level"]
          notes?: string | null
          sector_id: string
          source: string
        }
        Update: {
          capacity_type_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          expires_at?: string | null
          id?: string
          level?: Database["public"]["Enums"]["need_level"]
          notes?: string | null
          sector_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_needs_context_capacity_type_id_fkey"
            columns: ["capacity_type_id"]
            isOneToOne: false
            referencedRelation: "capacity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_needs_context_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_needs_context_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_needs_sms: {
        Row: {
          capacity_type_id: string
          confidence_score: number | null
          count: number
          created_at: string
          event_id: string
          evidence_text: string | null
          id: string
          level: Database["public"]["Enums"]["need_level"]
          sector_id: string
        }
        Insert: {
          capacity_type_id: string
          confidence_score?: number | null
          count?: number
          created_at?: string
          event_id: string
          evidence_text?: string | null
          id?: string
          level?: Database["public"]["Enums"]["need_level"]
          sector_id: string
        }
        Update: {
          capacity_type_id?: string
          confidence_score?: number | null
          count?: number
          created_at?: string
          event_id?: string
          evidence_text?: string | null
          id?: string
          level?: Database["public"]["Enums"]["need_level"]
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_needs_sms_capacity_type_id_fkey"
            columns: ["capacity_type_id"]
            isOneToOne: false
            referencedRelation: "capacity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_needs_sms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_needs_sms_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          aliases: string[] | null
          canonical_name: string
          confidence: number | null
          created_at: string
          event_id: string
          id: string
          latitude: number | null
          longitude: number | null
          source: string | null
          status: Database["public"]["Enums"]["sector_status"]
          updated_at: string
        }
        Insert: {
          aliases?: string[] | null
          canonical_name: string
          confidence?: number | null
          created_at?: string
          event_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["sector_status"]
          updated_at?: string
        }
        Update: {
          aliases?: string[] | null
          canonical_name?: string
          confidence?: number | null
          created_at?: string
          event_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["sector_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          confidence: number
          content: string
          created_at: string
          event_id: string
          field_report_id: string | null
          id: string
          level: string
          sector_id: string | null
          signal_type: string
          source: string
        }
        Insert: {
          confidence?: number
          content: string
          created_at?: string
          event_id: string
          field_report_id?: string | null
          id?: string
          level?: string
          sector_id?: string | null
          signal_type: string
          source: string
        }
        Update: {
          confidence?: number
          content?: string
          created_at?: string
          event_id?: string
          field_report_id?: string | null
          id?: string
          level?: string
          sector_id?: string | null
          signal_type?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_field_report_id_fkey"
            columns: ["field_report_id"]
            isOneToOne: false
            referencedRelation: "field_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          confidence_score: number | null
          created_at: string
          event_id: string | null
          extracted_need_type: string | null
          extracted_places: string[] | null
          id: string
          message_text: string
          phone_number: string
          processed: boolean | null
          received_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          event_id?: string | null
          extracted_need_type?: string | null
          extracted_places?: string[] | null
          id?: string
          message_text: string
          phone_number: string
          processed?: boolean | null
          received_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          event_id?: string | null
          extracted_need_type?: string | null
          extracted_places?: string[] | null
          id?: string
          message_text?: string
          phone_number?: string
          processed?: boolean | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "actor"
      availability_status: "ready" | "limited" | "unavailable"
      deployment_status:
        | "interested"
        | "confirmed"
        | "operating"
        | "suspended"
        | "finished"
      event_priority: "low" | "medium" | "high" | "critical"
      need_level: "low" | "medium" | "high" | "critical"
      report_status: "draft" | "confirmed" | "discarded"
      sector_status: "unresolved" | "tentative" | "resolved"
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
      app_role: ["admin", "actor"],
      availability_status: ["ready", "limited", "unavailable"],
      deployment_status: [
        "interested",
        "confirmed",
        "operating",
        "suspended",
        "finished",
      ],
      event_priority: ["low", "medium", "high", "critical"],
      need_level: ["low", "medium", "high", "critical"],
      report_status: ["draft", "confirmed", "discarded"],
      sector_status: ["unresolved", "tentative", "resolved"],
    },
  },
} as const
