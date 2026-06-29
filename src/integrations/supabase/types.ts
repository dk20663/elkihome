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
      autoreply_chains: {
        Row: {
          category: Database["public"]["Enums"]["avito_ad_category"]
          created_at: string
          id: string
          is_active: boolean
          name: string
          reset_after_days: number
          retrigger_after_days: number | null
          trigger_on_booking: boolean
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["avito_ad_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          reset_after_days?: number
          retrigger_after_days?: number | null
          trigger_on_booking?: boolean
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["avito_ad_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          reset_after_days?: number
          retrigger_after_days?: number | null
          trigger_on_booking?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      autoreply_steps: {
        Row: {
          chain_id: string
          created_at: string
          delay_minutes: number
          id: string
          is_greeting: boolean
          keyword_triggers: string[]
          order_index: number
          stop_on_client_reply: boolean
          text: string
          updated_at: string
        }
        Insert: {
          chain_id: string
          created_at?: string
          delay_minutes?: number
          id?: string
          is_greeting?: boolean
          keyword_triggers?: string[]
          order_index: number
          stop_on_client_reply?: boolean
          text: string
          updated_at?: string
        }
        Update: {
          chain_id?: string
          created_at?: string
          delay_minutes?: number
          id?: string
          is_greeting?: boolean
          keyword_triggers?: string[]
          order_index?: number
          stop_on_client_reply?: boolean
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autoreply_steps_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "autoreply_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      avito_account: {
        Row: {
          access_token: string | null
          avito_user_id: number | null
          created_at: string
          id: string
          token_expires_at: string | null
          updated_at: string
          webhook_registered_at: string | null
        }
        Insert: {
          access_token?: string | null
          avito_user_id?: number | null
          created_at?: string
          id?: string
          token_expires_at?: string | null
          updated_at?: string
          webhook_registered_at?: string | null
        }
        Update: {
          access_token?: string | null
          avito_user_id?: number | null
          created_at?: string
          id?: string
          token_expires_at?: string | null
          updated_at?: string
          webhook_registered_at?: string | null
        }
        Relationships: []
      }
      avito_ads: {
        Row: {
          category: Database["public"]["Enums"]["avito_ad_category"]
          chain_id: string | null
          created_at: string
          id: string
          item_id: number
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["avito_ad_category"]
          chain_id?: string | null
          created_at?: string
          id?: string
          item_id: number
          title?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["avito_ad_category"]
          chain_id?: string | null
          created_at?: string
          id?: string
          item_id?: number
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avito_ads_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "autoreply_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      avito_bookings_seen: {
        Row: {
          avito_booking_id: number
          chain_id: string | null
          chat_id: string | null
          created_at: string
          id: string
          item_id: number | null
          note: string | null
          processed_at: string | null
          status: string
        }
        Insert: {
          avito_booking_id: number
          chain_id?: string | null
          chat_id?: string | null
          created_at?: string
          id?: string
          item_id?: number | null
          note?: string | null
          processed_at?: string | null
          status?: string
        }
        Update: {
          avito_booking_id?: number
          chain_id?: string | null
          chat_id?: string | null
          created_at?: string
          id?: string
          item_id?: number | null
          note?: string | null
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "avito_bookings_seen_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "autoreply_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      avito_chat_state: {
        Row: {
          chain_completed_at: string | null
          chain_id: string | null
          chain_started_at: string | null
          chat_id: string
          client_replied_at: string | null
          created_at: string
          current_step: number
          id: string
          item_id: number | null
          last_auto_sent_at: string | null
          last_client_message_at: string | null
          next_run_at: string | null
          session_started_at: string | null
          updated_at: string
        }
        Insert: {
          chain_completed_at?: string | null
          chain_id?: string | null
          chain_started_at?: string | null
          chat_id: string
          client_replied_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          item_id?: number | null
          last_auto_sent_at?: string | null
          last_client_message_at?: string | null
          next_run_at?: string | null
          session_started_at?: string | null
          updated_at?: string
        }
        Update: {
          chain_completed_at?: string | null
          chain_id?: string | null
          chain_started_at?: string | null
          chat_id?: string
          client_replied_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          item_id?: number | null
          last_auto_sent_at?: string | null
          last_client_message_at?: string | null
          next_run_at?: string | null
          session_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avito_chat_state_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "autoreply_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      avito_message_log: {
        Row: {
          chain_id: string | null
          chat_id: string
          error: string | null
          id: string
          item_id: number | null
          sent_at: string
          status: Database["public"]["Enums"]["avito_message_status"]
          step_id: string | null
          step_index: number | null
          text: string
        }
        Insert: {
          chain_id?: string | null
          chat_id: string
          error?: string | null
          id?: string
          item_id?: number | null
          sent_at?: string
          status: Database["public"]["Enums"]["avito_message_status"]
          step_id?: string | null
          step_index?: number | null
          text: string
        }
        Update: {
          chain_id?: string | null
          chat_id?: string
          error?: string | null
          id?: string
          item_id?: number | null
          sent_at?: string
          status?: Database["public"]["Enums"]["avito_message_status"]
          step_id?: string | null
          step_index?: number | null
          text?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          bath_brooms: boolean
          cancelled: boolean
          check_in: string
          check_out: string
          citrus_infusion: boolean
          comment: string | null
          created_at: string
          created_by: string | null
          external_uid: string | null
          fir_infusion: boolean
          guest_count: number
          guest_name: string
          guest_phone: string
          house_id: string
          id: string
          manual_override: boolean
          plunge_pool: boolean
          sauna: boolean
          source: string
          synced_from: string | null
          total_price: number
          updated_at: string
        }
        Insert: {
          bath_brooms?: boolean
          cancelled?: boolean
          check_in: string
          check_out: string
          citrus_infusion?: boolean
          comment?: string | null
          created_at?: string
          created_by?: string | null
          external_uid?: string | null
          fir_infusion?: boolean
          guest_count?: number
          guest_name?: string
          guest_phone?: string
          house_id: string
          id?: string
          manual_override?: boolean
          plunge_pool?: boolean
          sauna?: boolean
          source?: string
          synced_from?: string | null
          total_price?: number
          updated_at?: string
        }
        Update: {
          bath_brooms?: boolean
          cancelled?: boolean
          check_in?: string
          check_out?: string
          citrus_infusion?: boolean
          comment?: string | null
          created_at?: string
          created_by?: string | null
          external_uid?: string | null
          fir_infusion?: boolean
          guest_count?: number
          guest_name?: string
          guest_phone?: string
          house_id?: string
          id?: string
          manual_override?: boolean
          plunge_pool?: boolean
          sauna?: boolean
          source?: string
          synced_from?: string | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      house_pricing: {
        Row: {
          date: string
          house_id: string
          id: string
          price: number
        }
        Insert: {
          date: string
          house_id: string
          id?: string
          price: number
        }
        Update: {
          date?: string
          house_id?: string
          id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "house_pricing_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          base_price_weekday: number
          base_price_weekend: number
          cian_ical_url: string
          color: string
          created_at: string
          guest_comment: string
          id: string
          name: string
          sutochno_ical_url: string
        }
        Insert: {
          base_price_weekday?: number
          base_price_weekend?: number
          cian_ical_url?: string
          color: string
          created_at?: string
          guest_comment?: string
          id?: string
          name: string
          sutochno_ical_url?: string
        }
        Update: {
          base_price_weekday?: number
          base_price_weekend?: number
          cian_ical_url?: string
          color?: string
          created_at?: string
          guest_comment?: string
          id?: string
          name?: string
          sutochno_ical_url?: string
        }
        Relationships: []
      }
      page_visits: {
        Row: {
          created_at: string
          id: string
          visited_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          visited_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          visited_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      vk_account: {
        Row: {
          access_token: string | null
          api_version: string
          callback_secret: string | null
          confirmation_string: string | null
          created_at: string
          group_id: number | null
          group_screen_name: string | null
          id: string
          lp_key: string | null
          lp_server: string | null
          lp_ts: number | null
          updated_at: string
          webhook_registered_at: string | null
        }
        Insert: {
          access_token?: string | null
          api_version?: string
          callback_secret?: string | null
          confirmation_string?: string | null
          created_at?: string
          group_id?: number | null
          group_screen_name?: string | null
          id?: string
          lp_key?: string | null
          lp_server?: string | null
          lp_ts?: number | null
          updated_at?: string
          webhook_registered_at?: string | null
        }
        Update: {
          access_token?: string | null
          api_version?: string
          callback_secret?: string | null
          confirmation_string?: string | null
          created_at?: string
          group_id?: number | null
          group_screen_name?: string | null
          id?: string
          lp_key?: string | null
          lp_server?: string | null
          lp_ts?: number | null
          updated_at?: string
          webhook_registered_at?: string | null
        }
        Relationships: []
      }
      vk_autoreply_chains: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          reset_after_days: number
          retrigger_after_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          reset_after_days?: number
          retrigger_after_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          reset_after_days?: number
          retrigger_after_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      vk_autoreply_steps: {
        Row: {
          chain_id: string
          created_at: string
          delay_minutes: number
          id: string
          is_greeting: boolean
          keyword_triggers: string[]
          order_index: number
          stop_on_client_reply: boolean
          text: string
          updated_at: string
        }
        Insert: {
          chain_id: string
          created_at?: string
          delay_minutes?: number
          id?: string
          is_greeting?: boolean
          keyword_triggers?: string[]
          order_index: number
          stop_on_client_reply?: boolean
          text: string
          updated_at?: string
        }
        Update: {
          chain_id?: string
          created_at?: string
          delay_minutes?: number
          id?: string
          is_greeting?: boolean
          keyword_triggers?: string[]
          order_index?: number
          stop_on_client_reply?: boolean
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vk_autoreply_steps_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "vk_autoreply_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      vk_chat_state: {
        Row: {
          chain_completed_at: string | null
          chain_id: string | null
          chain_started_at: string | null
          client_replied_at: string | null
          created_at: string
          current_step: number
          id: string
          last_auto_sent_at: string | null
          last_client_message_at: string | null
          next_run_at: string | null
          peer_id: number
          session_started_at: string | null
          updated_at: string
        }
        Insert: {
          chain_completed_at?: string | null
          chain_id?: string | null
          chain_started_at?: string | null
          client_replied_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          last_auto_sent_at?: string | null
          last_client_message_at?: string | null
          next_run_at?: string | null
          peer_id: number
          session_started_at?: string | null
          updated_at?: string
        }
        Update: {
          chain_completed_at?: string | null
          chain_id?: string | null
          chain_started_at?: string | null
          client_replied_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          last_auto_sent_at?: string | null
          last_client_message_at?: string | null
          next_run_at?: string | null
          peer_id?: number
          session_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vk_chat_state_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "vk_autoreply_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      vk_message_log: {
        Row: {
          chain_id: string | null
          error: string | null
          id: string
          peer_id: number
          sent_at: string
          status: Database["public"]["Enums"]["avito_message_status"]
          step_id: string | null
          step_index: number | null
          text: string
        }
        Insert: {
          chain_id?: string | null
          error?: string | null
          id?: string
          peer_id: number
          sent_at?: string
          status: Database["public"]["Enums"]["avito_message_status"]
          step_id?: string | null
          step_index?: number | null
          text: string
        }
        Update: {
          chain_id?: string | null
          error?: string | null
          id?: string
          peer_id?: number
          sent_at?: string
          status?: Database["public"]["Enums"]["avito_message_status"]
          step_id?: string | null
          step_index?: number | null
          text?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_bookings_view: {
        Row: {
          cancelled: boolean | null
          check_in: string | null
          check_out: string | null
          house_color: string | null
          house_id: string | null
          house_name: string | null
          id: string | null
          total_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      avito_ad_category: "realty" | "services"
      avito_message_status: "sent" | "blocked" | "error" | "skipped"
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
      avito_ad_category: ["realty", "services"],
      avito_message_status: ["sent", "blocked", "error", "skipped"],
    },
  },
} as const
