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
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      ai_prompt_blocks: {
        Row: {
          category: string
          content: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_locked: boolean
          key: string
          name: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_locked?: boolean
          key: string
          name: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_locked?: boolean
          key?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          intent: string | null
          metadata: Json | null
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          role_detected: string | null
          sender: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          intent?: string | null
          metadata?: Json | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          role_detected?: string | null
          sender: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          intent?: string | null
          metadata?: Json | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          role_detected?: string | null
          sender?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          color_tag: string | null
          created_at: string
          favorited_at: string | null
          id: string
          is_anonymous: boolean
          is_favorite: boolean | null
          locale: string | null
          matchmaking_state: Json | null
          session_token: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color_tag?: string | null
          created_at?: string
          favorited_at?: string | null
          id?: string
          is_anonymous?: boolean
          is_favorite?: boolean | null
          locale?: string | null
          matchmaking_state?: Json | null
          session_token?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color_tag?: string | null
          created_at?: string
          favorited_at?: string | null
          id?: string
          is_anonymous?: boolean
          is_favorite?: boolean | null
          locale?: string | null
          matchmaking_state?: Json | null
          session_token?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chunks: {
        Row: {
          char_end: number | null
          char_start: number | null
          created_at: string
          doc_id: string
          domain: string
          embedding: string | null
          embedding_model_id: string | null
          embedding_status: Database["public"]["Enums"]["embedding_status"]
          id: string
          language: string
          layer: Database["public"]["Enums"]["doc_layer"]
          position: number
          priority: number
          retrievable: boolean
          section_path: Json | null
          tags_json: Json | null
          text: string
          version: string
          version_id: string
        }
        Insert: {
          char_end?: number | null
          char_start?: number | null
          created_at?: string
          doc_id: string
          domain: string
          embedding?: string | null
          embedding_model_id?: string | null
          embedding_status?: Database["public"]["Enums"]["embedding_status"]
          id?: string
          language?: string
          layer: Database["public"]["Enums"]["doc_layer"]
          position?: number
          priority?: number
          retrievable?: boolean
          section_path?: Json | null
          tags_json?: Json | null
          text: string
          version: string
          version_id: string
        }
        Update: {
          char_end?: number | null
          char_start?: number | null
          created_at?: string
          doc_id?: string
          domain?: string
          embedding?: string | null
          embedding_model_id?: string | null
          embedding_status?: Database["public"]["Enums"]["embedding_status"]
          id?: string
          language?: string
          layer?: Database["public"]["Enums"]["doc_layer"]
          position?: number
          priority?: number
          retrievable?: boolean
          section_path?: Json | null
          tags_json?: Json | null
          text?: string
          version?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chunks_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      church_members: {
        Row: {
          added_by: string | null
          church_id: string
          created_at: string | null
          id: string
          joined_at: string | null
          member_role: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          added_by?: string | null
          church_id: string
          created_at?: string | null
          id?: string
          joined_at?: string | null
          member_role?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          added_by?: string | null
          church_id?: string
          created_at?: string | null
          id?: string
          joined_at?: string | null
          member_role?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          pastor_id: string | null
          phone: string | null
          state: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          pastor_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          pastor_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "churches_pastor_id_fkey"
            columns: ["pastor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_sessions: {
        Row: {
          buscador_feedback: Json | null
          buscador_id: string
          cancelled_by: string | null
          cancelled_reason: string | null
          chat_session_id: string | null
          created_at: string
          duration_minutes: number
          ended_at: string | null
          id: string
          meeting_url: string | null
          scheduled_at: string
          soldado_id: string
          soldado_notes: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["connection_session_status"]
          updated_at: string
        }
        Insert: {
          buscador_feedback?: Json | null
          buscador_id: string
          cancelled_by?: string | null
          cancelled_reason?: string | null
          chat_session_id?: string | null
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          meeting_url?: string | null
          scheduled_at: string
          soldado_id: string
          soldado_notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["connection_session_status"]
          updated_at?: string
        }
        Update: {
          buscador_feedback?: Json | null
          buscador_id?: string
          cancelled_by?: string | null
          cancelled_reason?: string | null
          chat_session_id?: string | null
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          meeting_url?: string | null
          scheduled_at?: string
          soldado_id?: string
          soldado_notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["connection_session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_sessions_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_events: {
        Row: {
          admin_notified: boolean | null
          created_at: string
          crisis_response_sent: string | null
          id: string
          keywords_matched: string[] | null
          message_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          session_id: string
          user_id: string | null
        }
        Insert: {
          admin_notified?: boolean | null
          created_at?: string
          crisis_response_sent?: string | null
          id?: string
          keywords_matched?: string[] | null
          message_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          session_id: string
          user_id?: string | null
        }
        Update: {
          admin_notified?: boolean | null
          created_at?: string
          crisis_response_sent?: string | null
          id?: string
          keywords_matched?: string[] | null
          message_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crisis_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crisis_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crisis_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crisis_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_corrections: {
        Row: {
          adherence_score: number | null
          corrected_response: string | null
          created_at: string
          curated_at: string | null
          curator_id: string | null
          diagnosis: Json | null
          feedback_item_id: string
          id: string
          include_in_training: boolean | null
          notes: string | null
          status: string
          updated_at: string
          violations: Json | null
        }
        Insert: {
          adherence_score?: number | null
          corrected_response?: string | null
          created_at?: string
          curated_at?: string | null
          curator_id?: string | null
          diagnosis?: Json | null
          feedback_item_id: string
          id?: string
          include_in_training?: boolean | null
          notes?: string | null
          status?: string
          updated_at?: string
          violations?: Json | null
        }
        Update: {
          adherence_score?: number | null
          corrected_response?: string | null
          created_at?: string
          curated_at?: string | null
          curator_id?: string | null
          diagnosis?: Json | null
          feedback_item_id?: string
          id?: string
          include_in_training?: boolean | null
          notes?: string | null
          status?: string
          updated_at?: string
          violations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "curated_corrections_curator_id_fkey"
            columns: ["curator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_corrections_feedback_item_id_fkey"
            columns: ["feedback_item_id"]
            isOneToOne: true
            referencedRelation: "feedback_dataset_items"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_versions: {
        Row: {
          changelog: string | null
          content_hash: string | null
          created_at: string
          doc_id: string
          id: string
          normalized_text: string | null
          raw_text: string | null
          source_file_url: string | null
          status: Database["public"]["Enums"]["doc_status"]
          version: string
        }
        Insert: {
          changelog?: string | null
          content_hash?: string | null
          created_at?: string
          doc_id: string
          id?: string
          normalized_text?: string | null
          raw_text?: string | null
          source_file_url?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          version?: string
        }
        Update: {
          changelog?: string | null
          content_hash?: string | null
          created_at?: string
          doc_id?: string
          id?: string
          normalized_text?: string | null
          raw_text?: string | null
          source_file_url?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          current_version_id: string | null
          domain: string
          id: string
          language: string
          layer: Database["public"]["Enums"]["doc_layer"]
          priority: number
          retrievable: boolean
          status: Database["public"]["Enums"]["doc_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          domain?: string
          id?: string
          language?: string
          layer?: Database["public"]["Enums"]["doc_layer"]
          priority?: number
          retrievable?: boolean
          status?: Database["public"]["Enums"]["doc_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          domain?: string
          id?: string
          language?: string
          layer?: Database["public"]["Enums"]["doc_layer"]
          priority?: number
          retrievable?: boolean
          status?: Database["public"]["Enums"]["doc_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          flag_name: string
          flag_value: boolean
          id: string
          scope: string
          scope_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          flag_name: string
          flag_value?: boolean
          id?: string
          scope?: string
          scope_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          flag_name?: string
          flag_value?: boolean
          id?: string
          scope?: string
          scope_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      feedback_dataset_items: {
        Row: {
          assistant_answer_text: string
          chat_session_id: string
          created_at: string
          curation_notes: string | null
          feedback_event_id: string | null
          feedback_label: Database["public"]["Enums"]["dataset_label"]
          feedback_note: string | null
          id: string
          include_in_export: boolean | null
          intent: string | null
          message_assistant_id: string
          message_user_id: string
          model_id: string | null
          phase: string | null
          rag_low_confidence: boolean | null
          rag_used: boolean | null
          retrieval_stats: Json | null
          retrieved_chunk_ids: string[] | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string | null
          updated_at: string
          user_id: string | null
          user_prompt_text: string
          was_rewritten: boolean | null
        }
        Insert: {
          assistant_answer_text: string
          chat_session_id: string
          created_at?: string
          curation_notes?: string | null
          feedback_event_id?: string | null
          feedback_label: Database["public"]["Enums"]["dataset_label"]
          feedback_note?: string | null
          id?: string
          include_in_export?: boolean | null
          intent?: string | null
          message_assistant_id: string
          message_user_id: string
          model_id?: string | null
          phase?: string | null
          rag_low_confidence?: boolean | null
          rag_used?: boolean | null
          retrieval_stats?: Json | null
          retrieved_chunk_ids?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          updated_at?: string
          user_id?: string | null
          user_prompt_text: string
          was_rewritten?: boolean | null
        }
        Update: {
          assistant_answer_text?: string
          chat_session_id?: string
          created_at?: string
          curation_notes?: string | null
          feedback_event_id?: string | null
          feedback_label?: Database["public"]["Enums"]["dataset_label"]
          feedback_note?: string | null
          id?: string
          include_in_export?: boolean | null
          intent?: string | null
          message_assistant_id?: string
          message_user_id?: string
          model_id?: string | null
          phase?: string | null
          rag_low_confidence?: boolean | null
          rag_used?: boolean | null
          retrieval_stats?: Json | null
          retrieved_chunk_ids?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          updated_at?: string
          user_id?: string | null
          user_prompt_text?: string
          was_rewritten?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_dataset_items_feedback_event_id_fkey"
            columns: ["feedback_event_id"]
            isOneToOne: false
            referencedRelation: "feedback_events"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_events: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string
          type: Database["public"]["Enums"]["feedback_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id: string
          type: Database["public"]["Enums"]["feedback_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string
          type?: Database["public"]["Enums"]["feedback_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      io_daily_sessions: {
        Row: {
          check_in_completed: boolean
          check_in_mood: string | null
          completed: boolean
          created_at: string
          duration_seconds: number | null
          escala_agencia: number | null
          escala_autonomia: number | null
          escala_clareza: number | null
          escala_constancia: number | null
          escala_identidade: number | null
          escala_regulacao: number | null
          escala_vitalidade: number | null
          feedback_generated: string | null
          id: string
          igi_at_session: number | null
          mission_completed: boolean
          mission_id: string | null
          phase_at_session: number
          reforco_identitario: string | null
          registro_text: string | null
          session_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in_completed?: boolean
          check_in_mood?: string | null
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          escala_agencia?: number | null
          escala_autonomia?: number | null
          escala_clareza?: number | null
          escala_constancia?: number | null
          escala_identidade?: number | null
          escala_regulacao?: number | null
          escala_vitalidade?: number | null
          feedback_generated?: string | null
          id?: string
          igi_at_session?: number | null
          mission_completed?: boolean
          mission_id?: string | null
          phase_at_session: number
          reforco_identitario?: string | null
          registro_text?: string | null
          session_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in_completed?: boolean
          check_in_mood?: string | null
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          escala_agencia?: number | null
          escala_autonomia?: number | null
          escala_clareza?: number | null
          escala_constancia?: number | null
          escala_identidade?: number | null
          escala_regulacao?: number | null
          escala_vitalidade?: number | null
          feedback_generated?: string | null
          id?: string
          igi_at_session?: number | null
          mission_completed?: boolean
          mission_id?: string | null
          phase_at_session?: number
          reforco_identitario?: string | null
          registro_text?: string | null
          session_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "io_daily_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "io_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      io_missions: {
        Row: {
          created_at: string
          description: string
          difficulty: string
          id: string
          is_active: boolean
          phase: number
          title: string
          type: string
          updated_at: string
          week_range: string
        }
        Insert: {
          created_at?: string
          description: string
          difficulty?: string
          id?: string
          is_active?: boolean
          phase: number
          title: string
          type: string
          updated_at?: string
          week_range: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: string
          id?: string
          is_active?: boolean
          phase?: number
          title?: string
          type?: string
          updated_at?: string
          week_range?: string
        }
        Relationships: []
      }
      io_phase_transitions: {
        Row: {
          created_at: string
          criteria_snapshot: Json
          from_phase: number
          id: string
          notes: string | null
          to_phase: number
          transition_type: string
          triggered_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criteria_snapshot: Json
          from_phase: number
          id?: string
          notes?: string | null
          to_phase: number
          transition_type: string
          triggered_by: string
          user_id: string
        }
        Update: {
          created_at?: string
          criteria_snapshot?: Json
          from_phase?: number
          id?: string
          notes?: string | null
          to_phase?: number
          transition_type?: string
          triggered_by?: string
          user_id?: string
        }
        Relationships: []
      }
      io_scale_entries: {
        Row: {
          created_at: string
          dimension: string
          id: string
          session_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          dimension: string
          id?: string
          session_id: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          dimension?: string
          id?: string
          session_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "io_scale_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "io_daily_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      io_user_phase: {
        Row: {
          created_at: string
          current_phase: number
          id: string
          igi_current: number
          igi_history: Json
          last_session_date: string | null
          phase_criteria_met: Json
          phase_entered_at: string
          phase_name: string | null
          streak_best: number
          streak_current: number
          total_sessions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_phase?: number
          id?: string
          igi_current?: number
          igi_history?: Json
          last_session_date?: string | null
          phase_criteria_met?: Json
          phase_entered_at?: string
          phase_name?: string | null
          streak_best?: number
          streak_current?: number
          total_sessions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_phase?: number
          id?: string
          igi_current?: number
          igi_history?: Json
          last_session_date?: string | null
          phase_criteria_met?: Json
          phase_entered_at?: string
          phase_name?: string | null
          streak_best?: number
          streak_current?: number
          total_sessions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          file_name: string | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      memory_items: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          key: string
          session_id: string | null
          ttl: string | null
          updated_at: string
          user_id: string | null
          value: Json
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          key: string
          session_id?: string | null
          ttl?: string | null
          updated_at?: string
          user_id?: string | null
          value: Json
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          key?: string
          session_id?: string | null
          ttl?: string | null
          updated_at?: string
          user_id?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "memory_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      observability_logs: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string
          flags_active: Json | null
          id: string
          latency_ms: number | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type: string
          flags_active?: Json | null
          id?: string
          latency_ms?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string
          flags_active?: Json | null
          id?: string
          latency_ms?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      professional_credentials: {
        Row: {
          created_at: string | null
          documents_url: string[] | null
          id: string
          license_number: string
          license_state: string
          profession: string
          updated_at: string | null
          user_id: string
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          documents_url?: string[] | null
          id?: string
          license_number: string
          license_state: string
          profession: string
          updated_at?: string | null
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          documents_url?: string[] | null
          id?: string
          license_number?: string
          license_state?: string
          profession?: string
          updated_at?: string | null
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_credentials_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          grammar_gender: string | null
          id: string
          is_public_profile: boolean | null
          last_active_at: string | null
          nome: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          grammar_gender?: string | null
          id: string
          is_public_profile?: boolean | null
          last_active_at?: string | null
          nome?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          grammar_gender?: string | null
          id?: string
          is_public_profile?: boolean | null
          last_active_at?: string | null
          nome?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          device_info: Json | null
          endpoint: string
          id: string
          is_active: boolean | null
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          device_info?: Json | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          device_info?: Json | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      retrieval_logs: {
        Row: {
          created_at: string
          filters_used: Json | null
          id: string
          intent: string | null
          latency_ms: number | null
          message_id: string | null
          query_text: string
          rag_plan: Json | null
          retrieved_chunk_ids: string[] | null
          role: string | null
          scores_json: Json | null
          session_id: string
        }
        Insert: {
          created_at?: string
          filters_used?: Json | null
          id?: string
          intent?: string | null
          latency_ms?: number | null
          message_id?: string | null
          query_text: string
          rag_plan?: Json | null
          retrieved_chunk_ids?: string[] | null
          role?: string | null
          scores_json?: Json | null
          session_id: string
        }
        Update: {
          created_at?: string
          filters_used?: Json | null
          id?: string
          intent?: string | null
          latency_ms?: number | null
          message_id?: string | null
          query_text?: string
          rag_plan?: Json | null
          retrieved_chunk_ids?: string[] | null
          role?: string | null
          scores_json?: Json | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retrieval_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      soldado_application_approvals: {
        Row: {
          application_id: string
          approved: boolean
          approver_id: string
          approver_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          id: string
          notes: string | null
        }
        Insert: {
          application_id: string
          approved: boolean
          approver_id: string
          approver_role: Database["public"]["Enums"]["app_role"]
          created_at?: string
          id?: string
          notes?: string | null
        }
        Update: {
          application_id?: string
          approved?: boolean
          approver_id?: string
          approver_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soldado_application_approvals_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "soldado_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soldado_application_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      soldado_applications: {
        Row: {
          created_at: string
          id: string
          rejection_reason: string | null
          sponsor_notes: string | null
          sponsor_role: Database["public"]["Enums"]["app_role"]
          sponsored_by: string
          status: Database["public"]["Enums"]["soldado_application_status"]
          testimony_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rejection_reason?: string | null
          sponsor_notes?: string | null
          sponsor_role: Database["public"]["Enums"]["app_role"]
          sponsored_by: string
          status?: Database["public"]["Enums"]["soldado_application_status"]
          testimony_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rejection_reason?: string | null
          sponsor_notes?: string | null
          sponsor_role?: Database["public"]["Enums"]["app_role"]
          sponsored_by?: string
          status?: Database["public"]["Enums"]["soldado_application_status"]
          testimony_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soldado_applications_sponsored_by_fkey"
            columns: ["sponsored_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soldado_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      soldado_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          buscador_id: string
          church_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          soldado_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          buscador_id: string
          church_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          soldado_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          buscador_id?: string
          church_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          soldado_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soldado_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soldado_assignments_buscador_id_fkey"
            columns: ["buscador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soldado_assignments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soldado_assignments_soldado_id_fkey"
            columns: ["soldado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      soldado_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_recurring: boolean | null
          soldado_id: string
          specific_date: string | null
          start_time: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_recurring?: boolean | null
          soldado_id: string
          specific_date?: string | null
          start_time: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_recurring?: boolean | null
          soldado_id?: string
          specific_date?: string | null
          start_time?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soldado_availability_soldado_id_fkey"
            columns: ["soldado_id"]
            isOneToOne: false
            referencedRelation: "soldado_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      soldado_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_available: boolean | null
          is_generalist: boolean | null
          max_weekly_sessions: number | null
          specialties: string[] | null
          testimony_id: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          is_available?: boolean | null
          is_generalist?: boolean | null
          max_weekly_sessions?: number | null
          specialties?: string[] | null
          testimony_id?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_available?: boolean | null
          is_generalist?: boolean | null
          max_weekly_sessions?: number | null
          specialties?: string[] | null
          testimony_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soldado_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soldado_profiles_testimony_id_fkey"
            columns: ["testimony_id"]
            isOneToOne: false
            referencedRelation: "testimonies"
            referencedColumns: ["id"]
          },
        ]
      }
      soldado_session_feedback: {
        Row: {
          buscador_engagement: number | null
          concerns: string | null
          created_at: string
          follow_up_needed: boolean | null
          follow_up_notes: string | null
          id: string
          progress_observed: string | null
          recommend_professional: boolean | null
          session_id: string
          soldado_id: string
        }
        Insert: {
          buscador_engagement?: number | null
          concerns?: string | null
          created_at?: string
          follow_up_needed?: boolean | null
          follow_up_notes?: string | null
          id?: string
          progress_observed?: string | null
          recommend_professional?: boolean | null
          session_id: string
          soldado_id: string
        }
        Update: {
          buscador_engagement?: number | null
          concerns?: string | null
          created_at?: string
          follow_up_needed?: boolean | null
          follow_up_notes?: string | null
          id?: string
          progress_observed?: string | null
          recommend_professional?: boolean | null
          session_id?: string
          soldado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soldado_session_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "connection_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      system_instructions: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_pinned: boolean | null
          layer: string | null
          name: string
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean | null
          layer?: string | null
          name: string
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean | null
          layer?: string | null
          name?: string
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      testimonies: {
        Row: {
          analysis: Json | null
          application_id: string | null
          audio_url: string
          created_at: string
          curated_at: string | null
          curated_by: string | null
          curator_notes: string | null
          duration_seconds: number
          embedding: string | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          status: Database["public"]["Enums"]["testimony_status"]
          transcript: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          application_id?: string | null
          audio_url: string
          created_at?: string
          curated_at?: string | null
          curated_by?: string | null
          curator_notes?: string | null
          duration_seconds?: number
          embedding?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          status?: Database["public"]["Enums"]["testimony_status"]
          transcript?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          application_id?: string | null
          audio_url?: string
          created_at?: string
          curated_at?: string | null
          curated_by?: string | null
          curator_notes?: string | null
          duration_seconds?: number
          embedding?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          status?: Database["public"]["Enums"]["testimony_status"]
          transcript?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonies_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "soldado_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonies_curated_by_fkey"
            columns: ["curated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      turn_insights: {
        Row: {
          admin_confirmed: boolean | null
          admin_notes: string | null
          chat_session_id: string
          created_at: string
          curated_at: string | null
          curated_by: string | null
          emotion_intensity: number | null
          emotion_stability: string | null
          exclude_from_training: boolean | null
          extraction_error: string | null
          extraction_status: string | null
          extractor_version: string
          id: string
          include_in_training: boolean | null
          issues_detected: string[] | null
          lie_active: Json | null
          lie_center: string | null
          lie_scenario: string | null
          lie_security_matrix: string | null
          mentor_model_id: string | null
          message_assistant_id: string
          message_user_id: string
          next_best_question_type:
            | Database["public"]["Enums"]["next_question_type"]
            | null
          observer_model_id: string | null
          overall_score: number | null
          phase: Database["public"]["Enums"]["journey_phase"] | null
          phase_confidence: number | null
          primary_emotions: string[] | null
          primary_virtue: Json | null
          quality_metrics: Json | null
          quality_rationale: string | null
          rubric_scores: Json | null
          shift_description: string | null
          shift_detected: boolean | null
          shift_evidence: string[] | null
          truth_target: Json | null
          turn_number: number
          updated_at: string
          zion_cycle: Json | null
        }
        Insert: {
          admin_confirmed?: boolean | null
          admin_notes?: string | null
          chat_session_id: string
          created_at?: string
          curated_at?: string | null
          curated_by?: string | null
          emotion_intensity?: number | null
          emotion_stability?: string | null
          exclude_from_training?: boolean | null
          extraction_error?: string | null
          extraction_status?: string | null
          extractor_version?: string
          id?: string
          include_in_training?: boolean | null
          issues_detected?: string[] | null
          lie_active?: Json | null
          lie_center?: string | null
          lie_scenario?: string | null
          lie_security_matrix?: string | null
          mentor_model_id?: string | null
          message_assistant_id: string
          message_user_id: string
          next_best_question_type?:
            | Database["public"]["Enums"]["next_question_type"]
            | null
          observer_model_id?: string | null
          overall_score?: number | null
          phase?: Database["public"]["Enums"]["journey_phase"] | null
          phase_confidence?: number | null
          primary_emotions?: string[] | null
          primary_virtue?: Json | null
          quality_metrics?: Json | null
          quality_rationale?: string | null
          rubric_scores?: Json | null
          shift_description?: string | null
          shift_detected?: boolean | null
          shift_evidence?: string[] | null
          truth_target?: Json | null
          turn_number?: number
          updated_at?: string
          zion_cycle?: Json | null
        }
        Update: {
          admin_confirmed?: boolean | null
          admin_notes?: string | null
          chat_session_id?: string
          created_at?: string
          curated_at?: string | null
          curated_by?: string | null
          emotion_intensity?: number | null
          emotion_stability?: string | null
          exclude_from_training?: boolean | null
          extraction_error?: string | null
          extraction_status?: string | null
          extractor_version?: string
          id?: string
          include_in_training?: boolean | null
          issues_detected?: string[] | null
          lie_active?: Json | null
          lie_center?: string | null
          lie_scenario?: string | null
          lie_security_matrix?: string | null
          mentor_model_id?: string | null
          message_assistant_id?: string
          message_user_id?: string
          next_best_question_type?:
            | Database["public"]["Enums"]["next_question_type"]
            | null
          observer_model_id?: string | null
          overall_score?: number | null
          phase?: Database["public"]["Enums"]["journey_phase"] | null
          phase_confidence?: number | null
          primary_emotions?: string[] | null
          primary_virtue?: Json | null
          quality_metrics?: Json | null
          quality_rationale?: string | null
          rubric_scores?: Json | null
          shift_description?: string | null
          shift_detected?: boolean | null
          shift_evidence?: string[] | null
          truth_target?: Json | null
          turn_number?: number
          updated_at?: string
          zion_cycle?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "turn_insights_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cohorts: {
        Row: {
          assigned_at: string
          assigned_by: string
          cohort_name: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string
          cohort_name?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          cohort_name?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          active_themes_count: number | null
          centros: Json | null
          created_at: string
          dom_original: string | null
          eneagrama: string | null
          fase_jornada: string | null
          global_avg_score: number | null
          id: string
          initial_pain_focus: string[] | null
          mecanismo_defesa_padrao: string | null
          medo_raiz_dominante: string | null
          onboarding_completed_at: string | null
          perfil_disc: string | null
          primary_center: string | null
          primary_security_matrix: string | null
          seguranca_quebrada_primaria: string | null
          spiritual_maturity: string | null
          total_shifts: number | null
          updated_at: string
          virtude_hiperdesenvolvida: string | null
        }
        Insert: {
          active_themes_count?: number | null
          centros?: Json | null
          created_at?: string
          dom_original?: string | null
          eneagrama?: string | null
          fase_jornada?: string | null
          global_avg_score?: number | null
          id: string
          initial_pain_focus?: string[] | null
          mecanismo_defesa_padrao?: string | null
          medo_raiz_dominante?: string | null
          onboarding_completed_at?: string | null
          perfil_disc?: string | null
          primary_center?: string | null
          primary_security_matrix?: string | null
          seguranca_quebrada_primaria?: string | null
          spiritual_maturity?: string | null
          total_shifts?: number | null
          updated_at?: string
          virtude_hiperdesenvolvida?: string | null
        }
        Update: {
          active_themes_count?: number | null
          centros?: Json | null
          created_at?: string
          dom_original?: string | null
          eneagrama?: string | null
          fase_jornada?: string | null
          global_avg_score?: number | null
          id?: string
          initial_pain_focus?: string[] | null
          mecanismo_defesa_padrao?: string | null
          medo_raiz_dominante?: string | null
          onboarding_completed_at?: string | null
          perfil_disc?: string | null
          primary_center?: string | null
          primary_security_matrix?: string | null
          seguranca_quebrada_primaria?: string | null
          spiritual_maturity?: string | null
          total_shifts?: number | null
          updated_at?: string
          virtude_hiperdesenvolvida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_themes: {
        Row: {
          avg_score: number | null
          center: string
          created_at: string | null
          current_phase: string | null
          first_detected_at: string | null
          id: string
          last_activity_at: string | null
          phase_confidence: number | null
          primary_lie: Json | null
          resolved_at: string | null
          scenario: string
          secondary_lies: Json[] | null
          security_matrix: string
          session_ids: string[] | null
          status: Database["public"]["Enums"]["theme_status"] | null
          target_truth: Json | null
          theme_label: string
          total_shifts: number | null
          turn_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_score?: number | null
          center: string
          created_at?: string | null
          current_phase?: string | null
          first_detected_at?: string | null
          id?: string
          last_activity_at?: string | null
          phase_confidence?: number | null
          primary_lie?: Json | null
          resolved_at?: string | null
          scenario: string
          secondary_lies?: Json[] | null
          security_matrix: string
          session_ids?: string[] | null
          status?: Database["public"]["Enums"]["theme_status"] | null
          target_truth?: Json | null
          theme_label: string
          total_shifts?: number | null
          turn_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_score?: number | null
          center?: string
          created_at?: string | null
          current_phase?: string | null
          first_detected_at?: string | null
          id?: string
          last_activity_at?: string | null
          phase_confidence?: number | null
          primary_lie?: Json | null
          resolved_at?: string | null
          scenario?: string
          secondary_lies?: Json[] | null
          security_matrix?: string
          session_ids?: string[] | null
          status?: Database["public"]["Enums"]["theme_status"] | null
          target_truth?: Json | null
          theme_label?: string
          total_shifts?: number | null
          turn_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      calculate_content_hash: { Args: { content: string }; Returns: string }
      calculate_igi: {
        Args: {
          p_agencia?: number
          p_autonomia?: number
          p_clareza?: number
          p_constancia?: number
          p_identidade?: number
          p_regulacao?: number
          p_vitalidade?: number
        }
        Returns: number
      }
      calculate_session_igi: { Args: { p_session_id: string }; Returns: number }
      can_accept_assignment: { Args: { _soldado_id: string }; Returns: boolean }
      can_manage_church_members: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      can_sponsor_soldado: { Args: { _sponsor_id: string }; Returns: boolean }
      can_view_journey: {
        Args: { _target_id: string; _viewer_id: string }
        Returns: boolean
      }
      count_active_assignments: {
        Args: { _soldado_id: string }
        Returns: number
      }
      get_application_approval_status: {
        Args: { _application_id: string }
        Returns: {
          admin_status: string
          is_complete: boolean
          pastor_status: string
          profissional_status: string
          total_approved: number
        }[]
      }
      get_feature_flag: {
        Args: { p_cohort_id?: string; p_flag_name: string; p_user_id?: string }
        Returns: boolean
      }
      get_io_phase_name: { Args: { p_phase: number }; Returns: string }
      get_soldado_weekly_sessions: {
        Args: { _soldado_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_church_member_of: {
        Args: { _member_id: string; _user_id: string }
        Returns: boolean
      }
      is_pastor_of_church: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      is_soldado_of: {
        Args: { _buscador_id: string; _soldado_id: string }
        Returns: boolean
      }
      search_chunks: {
        Args: {
          filter_domain?: string
          filter_layer?: Database["public"]["Enums"]["doc_layer"]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          doc_id: string
          doc_status: Database["public"]["Enums"]["doc_status"]
          doc_title: string
          domain: string
          embedding_model_id: string
          id: string
          layer: Database["public"]["Enums"]["doc_layer"]
          priority: number
          retrievable: boolean
          section_path: Json
          similarity: number
          tags_json: Json
          text: string
        }[]
      }
      search_testimonies_by_embedding: {
        Args: {
          exclude_soldados?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          analysis: Json
          id: string
          similarity: number
          transcript: string
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "soldado"
        | "buscador"
        | "pastor"
        | "igreja"
        | "profissional"
        | "auditor"
        | "desenvolvedor"
      connection_session_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      dataset_label: "useful" | "not_useful" | "theology_report"
      doc_layer: "CONSTITUICAO" | "NUCLEO" | "BIBLIOTECA"
      doc_status: "draft" | "review" | "published"
      embedding_status: "pending" | "processing" | "ok" | "failed"
      feedback_type: "helpful" | "not_helpful" | "heresia"
      journey_phase:
        | "ACOLHIMENTO"
        | "CLARIFICACAO"
        | "PADROES"
        | "RAIZ"
        | "TROCA"
        | "CONSOLIDACAO"
      next_question_type:
        | "EVIDENCE"
        | "ALTERNATIVE"
        | "SENSATION"
        | "VALUE"
        | "TRUTH"
        | "PRACTICE"
      risk_level: "none" | "low" | "medium" | "high"
      soldado_application_status:
        | "pending"
        | "testimony_required"
        | "under_review"
        | "approved"
        | "rejected"
      testimony_status:
        | "uploading"
        | "processing"
        | "analyzed"
        | "curated"
        | "published"
        | "rejected"
      theme_status: "active" | "in_progress" | "resolved" | "dormant"
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
      app_role: [
        "admin",
        "soldado",
        "buscador",
        "pastor",
        "igreja",
        "profissional",
        "auditor",
        "desenvolvedor",
      ],
      connection_session_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      dataset_label: ["useful", "not_useful", "theology_report"],
      doc_layer: ["CONSTITUICAO", "NUCLEO", "BIBLIOTECA"],
      doc_status: ["draft", "review", "published"],
      embedding_status: ["pending", "processing", "ok", "failed"],
      feedback_type: ["helpful", "not_helpful", "heresia"],
      journey_phase: [
        "ACOLHIMENTO",
        "CLARIFICACAO",
        "PADROES",
        "RAIZ",
        "TROCA",
        "CONSOLIDACAO",
      ],
      next_question_type: [
        "EVIDENCE",
        "ALTERNATIVE",
        "SENSATION",
        "VALUE",
        "TRUTH",
        "PRACTICE",
      ],
      risk_level: ["none", "low", "medium", "high"],
      soldado_application_status: [
        "pending",
        "testimony_required",
        "under_review",
        "approved",
        "rejected",
      ],
      testimony_status: [
        "uploading",
        "processing",
        "analyzed",
        "curated",
        "published",
        "rejected",
      ],
      theme_status: ["active", "in_progress", "resolved", "dormant"],
    },
  },
} as const
