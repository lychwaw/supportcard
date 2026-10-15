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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_rate_limits: {
        Row: {
          call_count: number
          call_date: string
          user_id: string
        }
        Insert: {
          call_count?: number
          call_date?: string
          user_id: string
        }
        Update: {
          call_count?: number
          call_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_daily: {
        Row: {
          action: string
          call_count: number
          call_date: string
          user_id: string
        }
        Insert: {
          action: string
          call_count?: number
          call_date?: string
          user_id: string
        }
        Update: {
          action?: string
          call_count?: number
          call_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          created_via: string
          event_date: string
          event_type: string | null
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          created_via?: string
          event_date: string
          event_type?: string | null
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          created_via?: string
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
      chatbot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      child_emergency_profiles: {
        Row: {
          allergies: string[] | null
          blood_type: string | null
          child_id: string
          created_at: string
          dentist_name: string | null
          dentist_phone: string | null
          doctor_name: string | null
          doctor_phone: string | null
          emergency_notes: string | null
          id: string
          medical_aid_number: string | null
          medical_aid_scheme: string | null
          medical_notes: string | null
          medications: string[] | null
          updated_at: string
        }
        Insert: {
          allergies?: string[] | null
          blood_type?: string | null
          child_id: string
          created_at?: string
          dentist_name?: string | null
          dentist_phone?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          emergency_notes?: string | null
          id?: string
          medical_aid_number?: string | null
          medical_aid_scheme?: string | null
          medical_notes?: string | null
          medications?: string[] | null
          updated_at?: string
        }
        Update: {
          allergies?: string[] | null
          blood_type?: string | null
          child_id?: string
          created_at?: string
          dentist_name?: string | null
          dentist_phone?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          emergency_notes?: string | null
          id?: string
          medical_aid_number?: string | null
          medical_aid_scheme?: string | null
          medical_notes?: string | null
          medications?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_emergency_profiles_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      child_goals: {
        Row: {
          child_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          notes: string | null
          target_amount: number
          title: string | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          target_amount: number
          title?: string | null
        }
        Update: {
          child_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          target_amount?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_goals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          avatar_url: string | null
          co_parent_id: string | null
          created_at: string | null
          current_amount: number | null
          custody_split_pct: number
          id: string
          name: string
          parent_id: string
          target_amount: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          co_parent_id?: string | null
          created_at?: string | null
          current_amount?: number | null
          custody_split_pct?: number
          id?: string
          name: string
          parent_id: string
          target_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          co_parent_id?: string | null
          created_at?: string | null
          current_amount?: number | null
          custody_split_pct?: number
          id?: string
          name?: string
          parent_id?: string
          target_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_co_parent_id_fkey"
            columns: ["co_parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_logs: {
        Row: {
          child_id: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          source: string | null
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          source?: string | null
          user_id: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_scores: {
        Row: {
          calculated_at: string | null
          child_id: string | null
          created_at: string | null
          id: string
          payment_adherence: number
          period_end: string
          period_start: string
          response_time_score: number
          score_percentage: number
          user_id: string
        }
        Insert: {
          calculated_at?: string | null
          child_id?: string | null
          created_at?: string | null
          id?: string
          payment_adherence?: number
          period_end: string
          period_start: string
          response_time_score?: number
          score_percentage: number
          user_id: string
        }
        Update: {
          calculated_at?: string | null
          child_id?: string | null
          created_at?: string | null
          id?: string
          payment_adherence?: number
          period_end?: string
          period_start?: string
          response_time_score?: number
          score_percentage?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_scores_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      court_orders: {
        Row: {
          child_id: string | null
          created_at: string
          document_url: string | null
          due_date: string | null
          id: string
          issued_date: string | null
          notes: string | null
          order_type: string
          reference_number: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          document_url?: string | null
          due_date?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          order_type?: string
          reference_number?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          document_url?: string | null
          due_date?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          order_type?: string
          reference_number?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_orders_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      curfew_rules: {
        Row: {
          active: boolean
          alert_minutes_before: number
          child_id: string
          created_at: string
          created_by: string | null
          curfew_time: string
          days_of_week: number[]
          id: string
        }
        Insert: {
          active?: boolean
          alert_minutes_before?: number
          child_id: string
          created_at?: string
          created_by?: string | null
          curfew_time: string
          days_of_week?: number[]
          id?: string
        }
        Update: {
          active?: boolean
          alert_minutes_before?: number
          child_id?: string
          created_at?: string
          created_by?: string | null
          curfew_time?: string
          days_of_week?: number[]
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curfew_rules_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curfew_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_checkins: {
        Row: {
          child_id: string | null
          created_at: string
          created_via: string
          event_type: string
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          user_id: string
          zone_id: string | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          created_via?: string
          event_type?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          user_id: string
          zone_id?: string | null
        }
        Update: {
          child_id?: string | null
          created_at?: string
          created_via?: string
          event_type?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          user_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custody_checkins_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_checkins_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "custody_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_zones: {
        Row: {
          child_id: string | null
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          radius_m: number
          user_id: string
          zone_type: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name: string
          radius_m?: number
          user_id: string
          zone_type: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          radius_m?: number
          user_id?: string
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_zones_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_zones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          contact_type: string
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          contact_type?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          contact_type?: string
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
      exchange_logs: {
        Row: {
          child_id: string | null
          created_at: string
          exchange_at: string
          handoff_from: string | null
          handoff_to: string | null
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          exchange_at?: string
          handoff_from?: string | null
          handoff_to?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          user_id: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          exchange_at?: string
          handoff_from?: string | null
          handoff_to?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_logs_user_id_fkey"
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
          approved_at: string | null
          approved_by_id: string | null
          category: string
          child_id: string | null
          created_at: string | null
          created_via: string
          currency: string
          description: string | null
          id: string
          paid_at: string | null
          payment_reference: string | null
          payment_status: string | null
          receipt_url: string | null
          rejection_reason: string | null
          requester_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by_id?: string | null
          category: string
          child_id?: string | null
          created_at?: string | null
          created_via?: string
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          requester_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by_id?: string | null
          category?: string
          child_id?: string | null
          created_at?: string | null
          created_via?: string
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          requester_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_requests_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      goal_contributions: {
        Row: {
          amount: number
          contributor_id: string
          created_at: string
          goal_id: string
          id: string
          note: string | null
        }
        Insert: {
          amount: number
          contributor_id: string
          created_at?: string
          goal_id: string
          id?: string
          note?: string | null
        }
        Update: {
          amount?: number
          contributor_id?: string
          created_at?: string
          goal_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "child_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      id_verifications: {
        Row: {
          country_of_birth: string | null
          created_at: string
          deceased_status: string | null
          first_name_match: boolean | null
          id: string
          id_type: string
          korapay_reference: string | null
          last_name_match: boolean | null
          on_hanis: boolean | null
          on_npr: boolean | null
          status: string
          user_id: string
        }
        Insert: {
          country_of_birth?: string | null
          created_at?: string
          deceased_status?: string | null
          first_name_match?: boolean | null
          id?: string
          id_type?: string
          korapay_reference?: string | null
          last_name_match?: boolean | null
          on_hanis?: boolean | null
          on_npr?: boolean | null
          status: string
          user_id: string
        }
        Update: {
          country_of_birth?: string | null
          created_at?: string
          deceased_status?: string | null
          first_name_match?: boolean | null
          id?: string
          id_type?: string
          korapay_reference?: string | null
          last_name_match?: boolean | null
          on_hanis?: boolean | null
          on_npr?: boolean | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      korapay_card_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          korapay_card_id: string
          korapay_transaction_id: string
          merchant_name: string | null
          narration: string | null
          status: string
          transaction_date: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          korapay_card_id: string
          korapay_transaction_id: string
          merchant_name?: string | null
          narration?: string | null
          status: string
          transaction_date?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          korapay_card_id?: string
          korapay_transaction_id?: string
          merchant_name?: string | null
          narration?: string | null
          status?: string
          transaction_date?: string | null
          type?: string
        }
        Relationships: []
      }
      korapay_cards: {
        Row: {
          balance: number
          brand: string | null
          child_id: string | null
          created_at: string
          currency: string
          expiry_month: number | null
          expiry_year: number | null
          id: string
          korapay_card_id: string
          korapay_reference: string | null
          masked_pan: string | null
          name_on_card: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          brand?: string | null
          child_id?: string | null
          created_at?: string
          currency?: string
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          korapay_card_id: string
          korapay_reference?: string | null
          masked_pan?: string | null
          name_on_card: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          brand?: string | null
          child_id?: string | null
          created_at?: string
          currency?: string
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          korapay_card_id?: string
          korapay_reference?: string | null
          masked_pan?: string | null
          name_on_card?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "korapay_cards_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          child_id: string | null
          created_at: string
          description: string | null
          document_type: string
          file_name: string
          file_path: string | null
          file_size: number | null
          id: string
          is_shared: boolean | null
          metadata: Json | null
          mime_type: string | null
          uploaded_at: string
          uploaded_by: string
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          description?: string | null
          document_type: string
          file_name: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_shared?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by: string
          user_id: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          description?: string | null
          document_type?: string
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_shared?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_user_id_fkey"
            columns: ["user_id"]
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
      parent_invites: {
        Row: {
          accepted_at: string | null
          child_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          invited_email: string
          invited_phone: string | null
          inviter_id: string
          is_active: boolean | null
          status: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          child_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invited_email: string
          invited_phone?: string | null
          inviter_id: string
          is_active?: boolean | null
          status?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          child_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invited_email?: string
          invited_phone?: string | null
          inviter_id?: string
          is_active?: boolean | null
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_invites_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_invites_audit: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          invite_id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          invite_id: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          invite_id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          bank_details: Json | null
          category: string
          code: string
          commission_eligible: boolean
          created_at: string
          email: string
          id: string
          monthly_payout_cap: number
          name: string
          payout_essential_cents: number
          payout_plus_cents: number
          payout_premium_cents: number
        }
        Insert: {
          bank_details?: Json | null
          category: string
          code: string
          commission_eligible?: boolean
          created_at?: string
          email: string
          id?: string
          monthly_payout_cap?: number
          name: string
          payout_essential_cents?: number
          payout_plus_cents?: number
          payout_premium_cents?: number
        }
        Update: {
          bank_details?: Json | null
          category?: string
          code?: string
          commission_eligible?: boolean
          created_at?: string
          email?: string
          id?: string
          monthly_payout_cap?: number
          name?: string
          payout_essential_cents?: number
          payout_plus_cents?: number
          payout_premium_cents?: number
        }
        Relationships: []
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
      payouts: {
        Row: {
          created_at: string
          id: string
          paid_at: string | null
          partner_id: string
          period: string
          reference: string | null
          total_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_id: string
          period: string
          reference?: string | null
          total_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_id?: string
          period?: string
          reference?: string | null
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "payouts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          allowed: boolean | null
          created_at: string | null
          id: string
          resource: string
          role: string
        }
        Insert: {
          action: string
          allowed?: boolean | null
          created_at?: string | null
          id?: string
          resource: string
          role: string
        }
        Update: {
          action?: string
          allowed?: boolean | null
          created_at?: string | null
          id?: string
          resource?: string
          role?: string
        }
        Relationships: []
      }
      professional_links: {
        Row: {
          accepted_at: string | null
          can_edit: boolean
          created_at: string
          id: string
          invited_email: string
          parent_id: string
          professional_id: string | null
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          can_edit?: boolean
          created_at?: string
          id?: string
          invited_email: string
          parent_id: string
          professional_id?: string | null
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          can_edit?: boolean
          created_at?: string
          id?: string
          invited_email?: string
          parent_id?: string
          professional_id?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_links_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_notes: {
        Row: {
          body: string | null
          id: string
          link_id: string
          professional_id: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          id?: string
          link_id: string
          professional_id: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          id?: string
          link_id?: string
          professional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_notes_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: true
            referencedRelation: "professional_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_notes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          dodo_customer_id: string | null
          dodo_subscription_id: string | null
          email: string | null
          expiry_date: string | null
          family_id: string | null
          full_name: string | null
          id: string
          id_verification_url: string | null
          id_verified: boolean | null
          id_verified_at: string | null
          is_founder: boolean
          onboarded_at: string | null
          parent_passcode_hash: string | null
          parent_passcode_hint: string | null
          parent_role: string | null
          passcode_failed_attempts: number | null
          passcode_locked_until: string | null
          passcode_updated_at: string | null
          phone: string | null
          preferred_currency: string | null
          referral_trial_ends_at: string | null
          require_child_passcode: boolean | null
          role: string | null
          subscription_status: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          dodo_customer_id?: string | null
          dodo_subscription_id?: string | null
          email?: string | null
          expiry_date?: string | null
          family_id?: string | null
          full_name?: string | null
          id: string
          id_verification_url?: string | null
          id_verified?: boolean | null
          id_verified_at?: string | null
          is_founder?: boolean
          onboarded_at?: string | null
          parent_passcode_hash?: string | null
          parent_passcode_hint?: string | null
          parent_role?: string | null
          passcode_failed_attempts?: number | null
          passcode_locked_until?: string | null
          passcode_updated_at?: string | null
          phone?: string | null
          preferred_currency?: string | null
          referral_trial_ends_at?: string | null
          require_child_passcode?: boolean | null
          role?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          dodo_customer_id?: string | null
          dodo_subscription_id?: string | null
          email?: string | null
          expiry_date?: string | null
          family_id?: string | null
          full_name?: string | null
          id?: string
          id_verification_url?: string | null
          id_verified?: boolean | null
          id_verified_at?: string | null
          is_founder?: boolean
          onboarded_at?: string | null
          parent_passcode_hash?: string | null
          parent_passcode_hint?: string | null
          parent_role?: string | null
          passcode_failed_attempts?: number | null
          passcode_locked_until?: string | null
          passcode_updated_at?: string | null
          phone?: string | null
          preferred_currency?: string | null
          referral_trial_ends_at?: string | null
          require_child_passcode?: boolean | null
          role?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
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
      recurring_expense_templates: {
        Row: {
          active: boolean
          amount: number
          category: string
          child_id: string | null
          created_at: string
          currency: string
          description: string | null
          frequency: string
          id: string
          next_due_date: string
          user_id: string
        }
        Insert: {
          active?: boolean
          amount: number
          category: string
          child_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          frequency: string
          id?: string
          next_due_date: string
          user_id: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string
          child_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          frequency?: string
          id?: string
          next_due_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expense_templates_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expense_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          meta: Json | null
          new_status: string | null
          old_status: string | null
          referral_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          meta?: Json | null
          new_status?: string | null
          old_status?: string | null
          referral_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json | null
          new_status?: string | null
          old_status?: string | null
          referral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code_entered_at: string
          code_used: string
          commission_cents: number | null
          created_at: string
          family_id: string | null
          id: string
          partner_id: string
          qualified_at: string | null
          signed_up_at: string
          status: string
          subscription_started_at: string | null
          tier: string | null
          user_id: string
          void_reason: string | null
        }
        Insert: {
          code_entered_at?: string
          code_used: string
          commission_cents?: number | null
          created_at?: string
          family_id?: string | null
          id?: string
          partner_id: string
          qualified_at?: string | null
          signed_up_at?: string
          status?: string
          subscription_started_at?: string | null
          tier?: string | null
          user_id: string
          void_reason?: string | null
        }
        Update: {
          code_entered_at?: string
          code_used?: string
          commission_cents?: number | null
          created_at?: string
          family_id?: string | null
          id?: string
          partner_id?: string
          qualified_at?: string | null
          signed_up_at?: string
          status?: string
          subscription_started_at?: string | null
          tier?: string | null
          user_id?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_notices: {
        Row: {
          category: string
          child_id: string | null
          created_at: string
          id: string
          notice_date: string
          notice_text: string
          school_name: string | null
          user_id: string
        }
        Insert: {
          category?: string
          child_id?: string | null
          created_at?: string
          id?: string
          notice_date?: string
          notice_text: string
          school_name?: string | null
          user_id: string
        }
        Update: {
          category?: string
          child_id?: string | null
          created_at?: string
          id?: string
          notice_date?: string
          notice_text?: string
          school_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_notices_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          card_id: string | null
          category: string | null
          child_id: string | null
          created_at: string | null
          id: string
          is_parent_logged: boolean | null
          location: string | null
          logged_by: string | null
          merchant_name: string | null
          notes: string | null
          payment_reference: string | null
          transaction_date: string | null
          transaction_type: string | null
          user_id: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          category?: string | null
          child_id?: string | null
          created_at?: string | null
          id?: string
          is_parent_logged?: boolean | null
          location?: string | null
          logged_by?: string | null
          merchant_name?: string | null
          notes?: string | null
          payment_reference?: string | null
          transaction_date?: string | null
          transaction_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          category?: string | null
          child_id?: string | null
          created_at?: string | null
          id?: string
          is_parent_logged?: boolean | null
          location?: string | null
          logged_by?: string | null
          merchant_name?: string | null
          notes?: string | null
          payment_reference?: string | null
          transaction_date?: string | null
          transaction_type?: string | null
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
            foreignKeyName: "transactions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_cards: {
        Row: {
          balance: number | null
          card_number: string
          card_type: string | null
          child_id: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          card_number: string
          card_type?: string | null
          child_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          user_id: string
        }
        Update: {
          balance?: number | null
          card_number?: string
          card_type?: string | null
          child_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
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
      visitation_logs: {
        Row: {
          accuracy_meters: number | null
          child_id: string | null
          created_at: string
          dispute_reason: string | null
          handoff_type: string
          id: string
          is_disputed: boolean | null
          latitude: number
          longitude: number
          notes: string | null
          timestamp: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          accuracy_meters?: number | null
          child_id?: string | null
          created_at?: string
          dispute_reason?: string | null
          handoff_type: string
          id?: string
          is_disputed?: boolean | null
          latitude: number
          longitude: number
          notes?: string | null
          timestamp?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          accuracy_meters?: number | null
          child_id?: string | null
          created_at?: string
          dispute_reason?: string | null
          handoff_type?: string
          id?: string
          is_disputed?: boolean | null
          latitude?: number
          longitude?: number
          notes?: string | null
          timestamp?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "visitation_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitation_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_pockets: {
        Row: {
          balance: number
          category: string
          child_id: string | null
          created_at: string
          id: string
          is_primary: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          category: string
          child_id?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          category?: string
          child_id?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_pockets_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_pockets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          child_id: string
          created_at: string
          fulfilled: boolean
          id: string
          name: string
          notes: string | null
          price_estimate: number | null
        }
        Insert: {
          child_id: string
          created_at?: string
          fulfilled?: boolean
          id?: string
          name: string
          notes?: string | null
          price_estimate?: number | null
        }
        Update: {
          child_id?: string
          created_at?: string
          fulfilled?: boolean
          id?: string
          name?: string
          notes?: string | null
          price_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount: number
          child_id: string
          created_at: string
          id: string
          pocket_id: string | null
          reason: string | null
          requested_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          amount: number
          child_id: string
          created_at?: string
          id?: string
          pocket_id?: string | null
          reason?: string | null
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          child_id?: string
          created_at?: string
          id?: string
          pocket_id?: string | null
          reason?: string | null
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_pocket_id_fkey"
            columns: ["pocket_id"]
            isOneToOne: false
            referencedRelation: "wallet_pockets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      child_safe_expenses: {
        Row: {
          amount: number | null
          category: string | null
          child_id: string | null
          created_at: string | null
          description: string | null
          id: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          child_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          child_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_history: {
        Row: {
          calculated_at: string | null
          child_id: string | null
          paid_amount: number | null
          payment_adherence: number | null
          period_end: string | null
          period_start: string | null
          response_time_score: number | null
          score_percentage: number | null
          unpaid_amount: number | null
          user_id: string | null
        }
        Insert: {
          calculated_at?: string | null
          child_id?: string | null
          paid_amount?: never
          payment_adherence?: number | null
          period_end?: string | null
          period_start?: string | null
          response_time_score?: number | null
          score_percentage?: number | null
          unpaid_amount?: never
          user_id?: string | null
        }
        Update: {
          calculated_at?: string | null
          child_id?: string | null
          paid_amount?: never
          payment_adherence?: number | null
          period_end?: string | null
          period_start?: string | null
          response_time_score?: number | null
          score_percentage?: number | null
          unpaid_amount?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_scores_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_expense_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      calculate_compliance_score: {
        Args: {
          p_child_id: string
          p_period_end: string
          p_period_start: string
          p_user_id: string
        }
        Returns: {
          payment_adherence: number
          response_time_score: number
          score_percentage: number
        }[]
      }
      capture_referral: {
        Args: { p_code: string; p_family_id?: string; p_user_id: string }
        Returns: string
      }
      check_ai_action_rate_limit: {
        Args: { p_action: string; p_max_per_day: number; p_user_id: string }
        Returns: boolean
      }
      check_ai_rate_limit: {
        Args: { p_max_per_day?: number; p_user_id: string }
        Returns: boolean
      }
      count_my_pending_expenses_today: { Args: never; Returns: number }
      determine_user_role: {
        Args: {
          user_age?: number
          user_created_at: string
          user_email: string
          user_id: string
        }
        Returns: string
      }
      expire_referral_trials: { Args: never; Returns: number }
      find_coparent_by_email: {
        Args: { lookup_email: string }
        Returns: {
          display_email: string
          full_name: string
          user_id: string
        }[]
      }
      get_user_role: { Args: { user_uuid: string }; Returns: string }
      is_active_professional_for: {
        Args: { target_parent_id: string }
        Returns: boolean
      }
      my_tier_usage: {
        Args: { p_resource: string }
        Returns: {
          max_count: number
          monthly: boolean
          tier: string
          used: number
        }[]
      }
      partner_commission_cents: {
        Args: {
          p_essential: number
          p_plus: number
          p_premium: number
          p_tier: string
        }
        Returns: number
      }
      qualify_referrals: { Args: never; Returns: number }
      reject_expense_request: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: undefined
      }
      tier_limit: {
        Args: { p_resource: string; p_tier: string }
        Returns: {
          max_count: number
          monthly: boolean
        }[]
      }
      tier_usage: {
        Args: { p_resource: string; p_user: string }
        Returns: {
          max_count: number
          monthly: boolean
          tier: string
          used: number
        }[]
      }
      verify_handoff: {
        Args: {
          p_child_id: string
          p_timestamp: string
          p_tolerance_minutes?: number
        }
        Returns: boolean
      }
      wipe_my_history: { Args: never; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
