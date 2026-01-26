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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      budget_categories: {
        Row: {
          category: string
          child_id: string | null
          created_at: string | null
          current_spent: number | null
          id: string
          monthly_limit: number
          user_id: string
        }
        Insert: {
          category: string
          child_id?: string | null
          created_at?: string | null
          current_spent?: number | null
          id?: string
          monthly_limit: number
          user_id: string
        }
        Update: {
          category?: string
          child_id?: string | null
          created_at?: string | null
          current_spent?: number | null
          id?: string
          monthly_limit?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          child_id: string | null
          created_at: string | null
          event_date: string
          event_type: string | null
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          created_at: string | null
          current_amount: number | null
          id: string
          name: string
          parent_id: string
          target_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_amount?: number | null
          id?: string
          name: string
          parent_id: string
          target_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_amount?: number | null
          id?: string
          name?: string
          parent_id?: string
          target_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_requests: {
        Row: {
          amount: number
          category: string
          child_id: string | null
          created_at: string | null
          description: string | null
          id: string
          paid_at: string | null
          payment_reference: string | null
          payment_status: string | null
          receipt_url: string | null
          requester_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: string
          child_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          receipt_url?: string | null
          requester_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          child_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          receipt_url?: string | null
          requester_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          last_four: string | null
          method_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          last_four?: string | null
          method_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          last_four?: string | null
          method_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          parent_passcode_hash: string | null
          parent_passcode_hint: string | null
          passcode_failed_attempts: number | null
          passcode_locked_until: string | null
          passcode_updated_at: string | null
          phone: string | null
          preferred_currency: string | null
          require_child_passcode: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          parent_passcode_hash?: string | null
          parent_passcode_hint?: string | null
          passcode_failed_attempts?: number | null
          passcode_locked_until?: string | null
          passcode_updated_at?: string | null
          phone?: string | null
          preferred_currency?: string | null
          require_child_passcode?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          parent_passcode_hash?: string | null
          parent_passcode_hint?: string | null
          passcode_failed_attempts?: number | null
          passcode_locked_until?: string | null
          passcode_updated_at?: string | null
          phone?: string | null
          preferred_currency?: string | null
          require_child_passcode?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_devices: {
        Row: {
          created_at: string | null
          device_token: string
          environment: string
          id: string
          last_seen: string | null
          platform: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_token: string
          environment?: string
          id?: string
          last_seen?: string | null
          platform?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_token?: string
          environment?: string
          id?: string
          last_seen?: string | null
          platform?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          card_id: string | null
          category: string | null
          created_at: string | null
          id: string
          location: string | null
          merchant_name: string | null
          transaction_date: string | null
          user_id: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          merchant_name?: string | null
          transaction_date?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          merchant_name?: string | null
          transaction_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "virtual_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_cards: {
        Row: {
          balance: number | null
          card_number: string
          cardholder_name: string | null
          card_type: string | null
          child_id: string | null
          created_at: string | null
          cvv: string | null
          expiry_month: number | null
          expiry_year: number | null
          id: string
          is_primary: boolean | null
          last_four: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          card_number: string
          cardholder_name?: string | null
          card_type?: string | null
          child_id?: string | null
          created_at?: string | null
          cvv?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_primary?: boolean | null
          last_four?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          card_number?: string
          cardholder_name?: string | null
          card_type?: string | null
          child_id?: string | null
          created_at?: string | null
          cvv?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_primary?: boolean | null
          last_four?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_cards_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
