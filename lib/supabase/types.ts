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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assessment_attempts: {
        Row: {
          completed_at: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["assessment_attempt_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["assessment_attempt_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["assessment_attempt_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_responses: {
        Row: {
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean
          question_id: string | null
          question_index: number
          section: Database["public"]["Enums"]["assessment_section"]
          selected_option: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct: boolean
          question_id?: string | null
          question_index: number
          section: Database["public"]["Enums"]["assessment_section"]
          selected_option: string
          user_id: string
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean
          question_id?: string | null
          question_index?: number
          section?: Database["public"]["Enums"]["assessment_section"]
          selected_option?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_section_progress: {
        Row: {
          attempt_id: string
          completed_at: string | null
          current_index: number
          id: string
          question_order: string[] | null
          section: Database["public"]["Enums"]["assessment_section"]
          started_at: string | null
          status: Database["public"]["Enums"]["section_progress_status"]
          user_id: string
        }
        Insert: {
          attempt_id: string
          completed_at?: string | null
          current_index?: number
          id?: string
          question_order?: string[] | null
          section: Database["public"]["Enums"]["assessment_section"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["section_progress_status"]
          user_id: string
        }
        Update: {
          attempt_id?: string
          completed_at?: string | null
          current_index?: number
          id?: string
          question_order?: string[] | null
          section?: Database["public"]["Enums"]["assessment_section"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["section_progress_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_section_progress_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_section_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capabilities: {
        Row: {
          capability_score: number
          confidence: Database["public"]["Enums"]["capability_confidence"]
          data_points: number
          domain: string
          id: string
          skill: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capability_score: number
          confidence: Database["public"]["Enums"]["capability_confidence"]
          data_points?: number
          domain: string
          id?: string
          skill: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capability_score?: number
          confidence?: Database["public"]["Enums"]["capability_confidence"]
          data_points?: number
          domain?: string
          id?: string
          skill?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capabilities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_history: {
        Row: {
          capability_score: number
          confidence: Database["public"]["Enums"]["capability_confidence"]
          id: string
          recorded_at: string
          skill: string
          source: Database["public"]["Enums"]["capability_evidence_source"]
          user_id: string
        }
        Insert: {
          capability_score: number
          confidence: Database["public"]["Enums"]["capability_confidence"]
          id?: string
          recorded_at?: string
          skill: string
          source: Database["public"]["Enums"]["capability_evidence_source"]
          user_id: string
        }
        Update: {
          capability_score?: number
          confidence?: Database["public"]["Enums"]["capability_confidence"]
          id?: string
          recorded_at?: string
          skill?: string
          source?: Database["public"]["Enums"]["capability_evidence_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      career_interest_questions: {
        Row: {
          attempt_id: string
          correct_option: string
          generated_at: string
          id: string
          options: Json
          question_index: number
          question_text: string
          skill_probe: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          correct_option: string
          generated_at?: string
          id?: string
          options: Json
          question_index: number
          question_text: string
          skill_probe: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          correct_option?: string
          generated_at?: string
          id?: string
          options?: Json
          question_index?: number
          question_text?: string
          skill_probe?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_interest_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_interest_questions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      career_interest_target: {
        Row: {
          attempt_id: string
          created_at: string
          stated_role: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          stated_role: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          stated_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_interest_target_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_interest_target_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      career_requirements: {
        Row: {
          career_role: string
          created_at: string
          id: string
          requirements: Json
          updated_at: string
        }
        Insert: {
          career_role: string
          created_at?: string
          id?: string
          requirements: Json
          updated_at?: string
        }
        Update: {
          career_role?: string
          created_at?: string
          id?: string
          requirements?: Json
          updated_at?: string
        }
        Relationships: []
      }
      guide_paths: {
        Row: {
          generated_at: string
          id: string
          is_primary: boolean
          phases: Json
          target_career: string
          user_id: string
          version: number
        }
        Insert: {
          generated_at?: string
          id?: string
          is_primary?: boolean
          phases: Json
          target_career: string
          user_id: string
          version?: number
        }
        Update: {
          generated_at?: string
          id?: string
          is_primary?: boolean
          phases?: Json
          target_career?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "guide_paths_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_memberships: {
        Row: {
          branch: string | null
          created_at: string
          id: string
          institution_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
          year: string | null
        }
        Insert: {
          branch?: string | null
          created_at?: string
          id?: string
          institution_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
          year?: string | null
        }
        Update: {
          branch?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_memberships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          city: string | null
          college_type: Database["public"]["Enums"]["college_type"]
          created_at: string
          id: string
          name: string
          slug: string
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          college_type?: Database["public"]["Enums"]["college_type"]
          created_at?: string
          id?: string
          name: string
          slug: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          college_type?: Database["public"]["Enums"]["college_type"]
          created_at?: string
          id?: string
          name?: string
          slug?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      interests: {
        Row: {
          distribution: Json | null
          target_role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          distribution?: Json | null
          target_role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          distribution?: Json | null
          target_role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
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
          created_at: string
          email: string
          full_name: string | null
          id: string
          primary_role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          primary_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          primary_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          active: boolean
          branches: string[] | null
          capability: string
          college_type: Database["public"]["Enums"]["college_type"] | null
          correct_option: string
          difficulty: number
          domain: string
          id: string
          options: Json
          question_text: string
          section: Database["public"]["Enums"]["assessment_section"]
          skill: string
        }
        Insert: {
          active?: boolean
          branches?: string[] | null
          capability: string
          college_type?: Database["public"]["Enums"]["college_type"] | null
          correct_option: string
          difficulty?: number
          domain: string
          id?: string
          options: Json
          question_text: string
          section: Database["public"]["Enums"]["assessment_section"]
          skill: string
        }
        Update: {
          active?: boolean
          branches?: string[] | null
          capability?: string
          college_type?: Database["public"]["Enums"]["college_type"] | null
          correct_option?: string
          difficulty?: number
          domain?: string
          id?: string
          options?: Json
          question_text?: string
          section?: Database["public"]["Enums"]["assessment_section"]
          skill?: string
        }
        Relationships: []
      }
      vault_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          item_type: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_type: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_items_user_id_fkey"
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
      get_or_create_institution: {
        Args: { institution_name: string }
        Returns: string
      }
      get_or_start_section: {
        Args: { p_section: Database["public"]["Enums"]["assessment_section"] }
        Returns: Json
      }
      record_assessment_response: {
        Args: {
          p_question_index: number
          p_section: Database["public"]["Enums"]["assessment_section"]
          p_selected_option: string
        }
        Returns: Json
      }
      role_requires_verification: {
        Args: { role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "student"
        | "faculty"
        | "hod"
        | "principal"
        | "vice_principal"
        | "ceo"
        | "mentor"
        | "professional"
      assessment_attempt_status: "in_progress" | "completed"
      assessment_section:
        | "quantitative_aptitude"
        | "logical_reasoning"
        | "verbal_communication"
        | "programming_fundamentals"
        | "engineering_mathematics"
        | "basic_sciences"
        | "career_interests"
      capability_confidence: "low" | "medium" | "high"
      capability_evidence_source:
        | "initial_assessment"
        | "reassessment"
        | "learning_module"
        | "project"
        | "arena_challenge"
      college_type:
        | "engineering"
        | "medical"
        | "management"
        | "arts_science"
        | "pharmacy"
        | "law"
        | "other"
      membership_status: "pending" | "active" | "revoked"
      section_progress_status: "not_started" | "in_progress" | "completed"
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
  public: {
    Enums: {
      app_role: [
        "student",
        "faculty",
        "hod",
        "principal",
        "vice_principal",
        "ceo",
        "mentor",
        "professional",
      ],
      assessment_attempt_status: ["in_progress", "completed"],
      assessment_section: [
        "quantitative_aptitude",
        "logical_reasoning",
        "verbal_communication",
        "programming_fundamentals",
        "engineering_mathematics",
        "basic_sciences",
        "career_interests",
      ],
      capability_confidence: ["low", "medium", "high"],
      capability_evidence_source: [
        "initial_assessment",
        "reassessment",
        "learning_module",
        "project",
        "arena_challenge",
      ],
      college_type: [
        "engineering",
        "medical",
        "management",
        "arts_science",
        "pharmacy",
        "law",
        "other",
      ],
      membership_status: ["pending", "active", "revoked"],
      section_progress_status: ["not_started", "in_progress", "completed"],
    },
  },
} as const
