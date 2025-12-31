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
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_instructions: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_content_hash: { Args: { content: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
          domain: string
          id: string
          layer: Database["public"]["Enums"]["doc_layer"]
          priority: number
          section_path: Json
          similarity: number
          tags_json: Json
          text: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "soldado" | "buscador"
      doc_layer: "CONSTITUICAO" | "NUCLEO" | "BIBLIOTECA"
      doc_status: "draft" | "review" | "published"
      embedding_status: "pending" | "processing" | "ok" | "failed"
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
      app_role: ["admin", "soldado", "buscador"],
      doc_layer: ["CONSTITUICAO", "NUCLEO", "BIBLIOTECA"],
      doc_status: ["draft", "review", "published"],
      embedding_status: ["pending", "processing", "ok", "failed"],
    },
  },
} as const
