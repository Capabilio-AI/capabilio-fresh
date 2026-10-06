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
      ai_interview_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          domain: string | null
          id: string
          improvements: Json | null
          mode: Database["public"]["Enums"]["interview_mode"]
          overall_score: number | null
          questions: Json
          role_target: string | null
          skill_scores: Json | null
          started_at: string
          status: Database["public"]["Enums"]["interview_status"]
          strengths: Json | null
          transcript: Json
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          improvements?: Json | null
          mode: Database["public"]["Enums"]["interview_mode"]
          overall_score?: number | null
          questions: Json
          role_target?: string | null
          skill_scores?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          strengths?: Json | null
          transcript?: Json
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          improvements?: Json | null
          mode?: Database["public"]["Enums"]["interview_mode"]
          overall_score?: number | null
          questions?: Json
          role_target?: string | null
          skill_scores?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          strengths?: Json | null
          transcript?: Json
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          applied_at: string
          id: string
          opportunity_id: string
          status: string
          user_id: string
        }
        Insert: {
          applied_at?: string
          id?: string
          opportunity_id: string
          status?: string
          user_id: string
        }
        Update: {
          applied_at?: string
          id?: string
          opportunity_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_attempt_completions: {
        Row: {
          attempt_id: string
          challenge_id: string
          completed_at: string
          evidence_id: string | null
          grading_version: string
          points: number
          rating_after: number
          rating_before: number
          rating_delta: number
          role_key: string
          skill_area_key: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          challenge_id: string
          completed_at?: string
          evidence_id?: string | null
          grading_version: string
          points: number
          rating_after: number
          rating_before: number
          rating_delta: number
          role_key: string
          skill_area_key: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          challenge_id?: string
          completed_at?: string
          evidence_id?: string | null
          grading_version?: string
          points?: number
          rating_after?: number
          rating_before?: number
          rating_delta?: number
          role_key?: string
          skill_area_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_attempt_completions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "arena_domain_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_attempt_completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_attempt_completions_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_challenge_attempts: {
        Row: {
          answered_count: number
          completed_at: string | null
          correct_count: number
          id: string
          question_order: string[]
          rating_after: number | null
          rating_before: number | null
          rating_delta: number | null
          section: Database["public"]["Enums"]["assessment_section"]
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          answered_count?: number
          completed_at?: string | null
          correct_count?: number
          id?: string
          question_order: string[]
          rating_after?: number | null
          rating_before?: number | null
          rating_delta?: number | null
          section: Database["public"]["Enums"]["assessment_section"]
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          answered_count?: number
          completed_at?: string | null
          correct_count?: number
          id?: string
          question_order?: string[]
          rating_after?: number | null
          rating_before?: number | null
          rating_delta?: number | null
          section?: Database["public"]["Enums"]["assessment_section"]
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_challenge_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_challenge_completions: {
        Row: {
          challenge_id: string
          code_submitted: string | null
          completed_at: string
          elo_delta: number
          id: string
          is_correct: boolean
          scope_key: string
          track: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          code_submitted?: string | null
          completed_at?: string
          elo_delta?: number
          id?: string
          is_correct: boolean
          scope_key: string
          track: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          code_submitted?: string | null
          completed_at?: string
          elo_delta?: number
          id?: string
          is_correct?: boolean
          scope_key?: string
          track?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_challenge_completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_challenge_skills: {
        Row: {
          challenge_id: string
          skill_id: string
          source: string
        }
        Insert: {
          challenge_id: string
          skill_id: string
          source: string
        }
        Update: {
          challenge_id?: string
          skill_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_challenge_skills_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_challenge_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_challenges: {
        Row: {
          active: boolean
          answer_key: Json | null
          answer_unit: string | null
          category: string
          content: Json | null
          created_at: string
          difficulty: string
          elo_gain: number
          expected_output: string
          generated_at: string | null
          generation_model: string | null
          generation_provider: string | null
          generation_version: string | null
          grading_version: string | null
          ground_truth_query: string | null
          id: string
          kind: string
          language: string
          objective: string
          requester: string | null
          scenario: string
          scope_key: string
          sequence: number | null
          skill_area_key: string | null
          skill_tags: string[]
          starter_code: string | null
          stdin: string | null
          time_limit_minutes: number
          title: string
          tool_type: string | null
          track: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          answer_key?: Json | null
          answer_unit?: string | null
          category: string
          content?: Json | null
          created_at?: string
          difficulty: string
          elo_gain?: number
          expected_output: string
          generated_at?: string | null
          generation_model?: string | null
          generation_provider?: string | null
          generation_version?: string | null
          grading_version?: string | null
          ground_truth_query?: string | null
          id?: string
          kind?: string
          language: string
          objective: string
          requester?: string | null
          scenario: string
          scope_key: string
          sequence?: number | null
          skill_area_key?: string | null
          skill_tags?: string[]
          starter_code?: string | null
          stdin?: string | null
          time_limit_minutes?: number
          title: string
          tool_type?: string | null
          track: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          answer_key?: Json | null
          answer_unit?: string | null
          category?: string
          content?: Json | null
          created_at?: string
          difficulty?: string
          elo_gain?: number
          expected_output?: string
          generated_at?: string | null
          generation_model?: string | null
          generation_provider?: string | null
          generation_version?: string | null
          grading_version?: string | null
          ground_truth_query?: string | null
          id?: string
          kind?: string
          language?: string
          objective?: string
          requester?: string | null
          scenario?: string
          scope_key?: string
          sequence?: number | null
          skill_area_key?: string | null
          skill_tags?: string[]
          starter_code?: string | null
          stdin?: string | null
          time_limit_minutes?: number
          title?: string
          tool_type?: string | null
          track?: string
          user_id?: string | null
        }
        Relationships: []
      }
      arena_domain_assignments: {
        Row: {
          assigned_at: string
          challenge_id: string
          completed_at: string | null
          cycle_number: number | null
          grade: Json | null
          id: string
          next_available_at: string | null
          role_key: string
          skill_area_key: string | null
          status: string
          submission: Json | null
          submission_count: number
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          challenge_id: string
          completed_at?: string | null
          cycle_number?: number | null
          grade?: Json | null
          id?: string
          next_available_at?: string | null
          role_key: string
          skill_area_key?: string | null
          status?: string
          submission?: Json | null
          submission_count?: number
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          challenge_id?: string
          completed_at?: string | null
          cycle_number?: number | null
          grade?: Json | null
          id?: string
          next_available_at?: string | null
          role_key?: string
          skill_area_key?: string | null
          status?: string
          submission?: Json | null
          submission_count?: number
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_domain_assignments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_domain_roles: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          match_keywords: string[]
          parent_skill_name: string
          role_key: string
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          match_keywords?: string[]
          parent_skill_name: string
          role_key: string
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          match_keywords?: string[]
          parent_skill_name?: string
          role_key?: string
        }
        Relationships: []
      }
      arena_domain_stats: {
        Row: {
          current_streak: number
          last_completed_week: string | null
          longest_streak: number
          points: number
          tasks_completed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_completed_week?: string | null
          longest_streak?: number
          points?: number
          tasks_completed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_completed_week?: string | null
          longest_streak?: number
          points?: number
          tasks_completed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      arena_ratings: {
        Row: {
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          rating?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_rotation_state: {
        Row: {
          cycle_number: number
          last_served: string | null
          remaining: string[]
          role_key: string
          served: string[]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          cycle_number?: number
          last_served?: string | null
          remaining?: string[]
          role_key: string
          served?: string[]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          cycle_number?: number
          last_served?: string | null
          remaining?: string[]
          role_key?: string
          served?: string[]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "arena_rotation_state_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "arena_domain_roles"
            referencedColumns: ["role_key"]
          },
        ]
      }
      arena_skill_areas: {
        Row: {
          area_key: string
          created_at: string
          disabled_reason: string | null
          display_name: string
          enabled: boolean
          generation_version: string
          grading_version: string
          role_key: string
          skill_id: string | null
          skill_node_key: string
          sort_order: number
          tool_type: string
        }
        Insert: {
          area_key: string
          created_at?: string
          disabled_reason?: string | null
          display_name: string
          enabled?: boolean
          generation_version: string
          grading_version: string
          role_key: string
          skill_id?: string | null
          skill_node_key: string
          sort_order?: number
          tool_type: string
        }
        Update: {
          area_key?: string
          created_at?: string
          disabled_reason?: string | null
          display_name?: string
          enabled?: boolean
          generation_version?: string
          grading_version?: string
          role_key?: string
          skill_id?: string | null
          skill_node_key?: string
          sort_order?: number
          tool_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_skill_areas_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "arena_domain_roles"
            referencedColumns: ["role_key"]
          },
          {
            foreignKeyName: "arena_skill_areas_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_skill_ratings: {
        Row: {
          area_key: string
          last_verified_at: string | null
          rating: number
          role_key: string
          updated_at: string
          user_id: string
          verified_count: number
        }
        Insert: {
          area_key: string
          last_verified_at?: string | null
          rating?: number
          role_key: string
          updated_at?: string
          user_id: string
          verified_count?: number
        }
        Update: {
          area_key?: string
          last_verified_at?: string | null
          rating?: number
          role_key?: string
          updated_at?: string
          user_id?: string
          verified_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "arena_skill_ratings_role_key_area_key_fkey"
            columns: ["role_key", "area_key"]
            isOneToOne: false
            referencedRelation: "arena_skill_areas"
            referencedColumns: ["role_key", "area_key"]
          },
        ]
      }
      arena_stream_stats: {
        Row: {
          current_streak: number
          last_completed_week: string | null
          longest_streak: number
          points: number
          tasks_completed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_completed_week?: string | null
          longest_streak?: number
          points?: number
          tasks_completed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_completed_week?: string | null
          longest_streak?: number
          points?: number
          tasks_completed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      arena_stream_weeks: {
        Row: {
          challenge_ids: string[]
          created_at: string
          id: string
          scope_key: string
          user_id: string
          week_start: string
        }
        Insert: {
          challenge_ids?: string[]
          created_at?: string
          id?: string
          scope_key: string
          user_id: string
          week_start: string
        }
        Update: {
          challenge_ids?: string[]
          created_at?: string
          id?: string
          scope_key?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
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
      audit_logs: {
        Row: {
          access_reason: string | null
          action: string
          actor_id: string | null
          consent_context: Json | null
          created_at: string
          id: string
          organisation_id: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          access_reason?: string | null
          action: string
          actor_id?: string | null
          consent_context?: Json | null
          created_at?: string
          id?: string
          organisation_id?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          access_reason?: string | null
          action?: string
          actor_id?: string | null
          consent_context?: Json | null
          created_at?: string
          id?: string
          organisation_id?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "institutions"
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
      career_skill_requirements: {
        Row: {
          career_id: string
          created_at: string
          importance: string
          required_by_stage: string
          skill_id: string
          target_level: number
        }
        Insert: {
          career_id: string
          created_at?: string
          importance: string
          required_by_stage?: string
          skill_id: string
          target_level: number
        }
        Update: {
          career_id?: string
          created_at?: string
          importance?: string
          required_by_stage?: string
          skill_id?: string
          target_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "career_skill_requirements_career_id_fkey"
            columns: ["career_id"]
            isOneToOne: false
            referencedRelation: "careers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_skill_requirements_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      career_suggestions: {
        Row: {
          created_at: string
          id: string
          resolved_at: string | null
          source_text: string
          status: string
          student_id: string
          suggested_career_ids: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          source_text: string
          status?: string
          student_id: string
          suggested_career_ids?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          source_text?: string
          status?: string
          student_id?: string
          suggested_career_ids?: string[]
        }
        Relationships: []
      }
      careers: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          legacy_role: string | null
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          legacy_role?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          legacy_role?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      certification_careers: {
        Row: {
          career_id: string
          certification_id: string
          relevance: string
        }
        Insert: {
          career_id: string
          certification_id: string
          relevance?: string
        }
        Update: {
          career_id?: string
          certification_id?: string
          relevance?: string
        }
        Relationships: [
          {
            foreignKeyName: "certification_careers_career_id_fkey"
            columns: ["career_id"]
            isOneToOne: false
            referencedRelation: "careers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certification_careers_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certification_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_catalog: {
        Row: {
          cost: string | null
          created_at: string
          difficulty: string | null
          duration: string | null
          eligibility: string | null
          id: string
          is_active: boolean
          name: string
          provider: string
          updated_at: string
          url: string | null
        }
        Insert: {
          cost?: string | null
          created_at?: string
          difficulty?: string | null
          duration?: string | null
          eligibility?: string | null
          id?: string
          is_active?: boolean
          name: string
          provider: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          cost?: string | null
          created_at?: string
          difficulty?: string | null
          duration?: string | null
          eligibility?: string | null
          id?: string
          is_active?: boolean
          name?: string
          provider?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      certification_skills: {
        Row: {
          certification_id: string
          skill_id: string
        }
        Insert: {
          certification_id: string
          skill_id: string
        }
        Update: {
          certification_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certification_skills_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certification_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certification_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      class_materials: {
        Row: {
          author_membership_id: string
          body: string | null
          branch: string
          description: string | null
          id: string
          institution_id: string
          published_at: string
          subject_id: string | null
          title: string
          type: string
          url: string | null
          year: number
        }
        Insert: {
          author_membership_id: string
          body?: string | null
          branch: string
          description?: string | null
          id?: string
          institution_id: string
          published_at?: string
          subject_id?: string | null
          title: string
          type: string
          url?: string | null
          year: number
        }
        Update: {
          author_membership_id?: string
          body?: string | null
          branch?: string
          description?: string | null
          id?: string
          institution_id?: string
          published_at?: string
          subject_id?: string | null
          title?: string
          type?: string
          url?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_materials_author_membership_id_fkey"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_materials_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_materials_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_project_grades: {
        Row: {
          feedback: string | null
          grade: string
          graded_at: string
          graded_by_membership_id: string
          group_id: string
          id: string
          member_contribution_notes: Json
        }
        Insert: {
          feedback?: string | null
          grade: string
          graded_at?: string
          graded_by_membership_id: string
          group_id: string
          id?: string
          member_contribution_notes?: Json
        }
        Update: {
          feedback?: string | null
          grade?: string
          graded_at?: string
          graded_by_membership_id?: string
          group_id?: string
          id?: string
          member_contribution_notes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "class_project_grades_graded_by_membership_id_fkey"
            columns: ["graded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_project_grades_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "class_project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      class_project_group_members: {
        Row: {
          branch: string | null
          group_id: string
          id: string
          joined_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          branch?: string | null
          group_id: string
          id?: string
          joined_at?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          branch?: string | null
          group_id?: string
          id?: string
          joined_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_project_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_project_group_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "class_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_project_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_project_groups: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          name: string
          project_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          name: string
          project_id: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          name?: string
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_project_groups_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_project_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "class_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_projects: {
        Row: {
          brief: string
          created_at: string
          created_by_membership_id: string
          deadline_at: string
          department_scope: string[] | null
          id: string
          institution_id: string
          starts_at: string
          status: string
          subject_id: string | null
          submission_type: string
          team_size: number
          title: string
          weekly_report_required: boolean
        }
        Insert: {
          brief: string
          created_at?: string
          created_by_membership_id: string
          deadline_at: string
          department_scope?: string[] | null
          id?: string
          institution_id: string
          starts_at?: string
          status?: string
          subject_id?: string | null
          submission_type: string
          team_size?: number
          title: string
          weekly_report_required?: boolean
        }
        Update: {
          brief?: string
          created_at?: string
          created_by_membership_id?: string
          deadline_at?: string
          department_scope?: string[] | null
          id?: string
          institution_id?: string
          starts_at?: string
          status?: string
          subject_id?: string | null
          submission_type?: string
          team_size?: number
          title?: string
          weekly_report_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "class_projects_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_projects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_projects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_submissions: {
        Row: {
          group_id: string
          id: string
          link_url: string | null
          physical_confirmed_by_membership_id: string | null
          submission_type: string
          submitted_at: string
          submitted_by_user_id: string | null
        }
        Insert: {
          group_id: string
          id?: string
          link_url?: string | null
          physical_confirmed_by_membership_id?: string | null
          submission_type: string
          submitted_at?: string
          submitted_by_user_id?: string | null
        }
        Update: {
          group_id?: string
          id?: string
          link_url?: string | null
          physical_confirmed_by_membership_id?: string | null
          submission_type?: string
          submitted_at?: string
          submitted_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_submissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "class_project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_submissions_physical_confirmed_by_membership_id_fkey"
            columns: ["physical_confirmed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_submissions_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_weekly_reports: {
        Row: {
          attachment_url: string | null
          content: string
          group_id: string
          id: string
          staff_feedback: string | null
          staff_seen_at: string | null
          submitted_at: string
          submitted_by_user_id: string
          week_number: number
        }
        Insert: {
          attachment_url?: string | null
          content: string
          group_id: string
          id?: string
          staff_feedback?: string | null
          staff_seen_at?: string | null
          submitted_at?: string
          submitted_by_user_id: string
          week_number: number
        }
        Update: {
          attachment_url?: string | null
          content?: string
          group_id?: string
          id?: string
          staff_feedback?: string | null
          staff_seen_at?: string | null
          submitted_at?: string
          submitted_by_user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_weekly_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_weekly_reports_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          created_at: string
          department_id: string
          entry_year_semester: string
          graduation_year_semester: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          entry_year_semester: string
          graduation_year_semester: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          entry_year_semester?: string
          graduation_year_semester?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      course_outcome_skill_mappings: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          confidence: number | null
          course_id: string
          course_outcome_id: string
          created_at: string
          created_by: string | null
          evidence_source: string | null
          id: string
          importance: string | null
          mapping_source: string
          skill_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number | null
          course_id: string
          course_outcome_id: string
          created_at?: string
          created_by?: string | null
          evidence_source?: string | null
          id?: string
          importance?: string | null
          mapping_source: string
          skill_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number | null
          course_id?: string
          course_outcome_id?: string
          created_at?: string
          created_by?: string | null
          evidence_source?: string | null
          id?: string
          importance?: string | null
          mapping_source?: string
          skill_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_outcome_skill_mappings_course_outcome_id_course_id_fkey"
            columns: ["course_outcome_id", "course_id"]
            isOneToOne: false
            referencedRelation: "course_outcomes"
            referencedColumns: ["id", "course_id"]
          },
          {
            foreignKeyName: "course_outcome_skill_mappings_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      course_outcomes: {
        Row: {
          bloom_level: string | null
          code: string
          course_id: string
          created_at: string
          id: string
          provenance: string | null
          sort_order: number
          text: string
        }
        Insert: {
          bloom_level?: string | null
          code: string
          course_id: string
          created_at?: string
          id?: string
          provenance?: string | null
          sort_order?: number
          text: string
        }
        Update: {
          bloom_level?: string | null
          code?: string
          course_id?: string
          created_at?: string
          id?: string
          provenance?: string | null
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_outcomes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_skill_mappings: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          confidence: number | null
          course_id: string
          created_at: string
          created_by: string | null
          evidence_source: string | null
          id: string
          importance: string | null
          mapping_source: string
          skill_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number | null
          course_id: string
          created_at?: string
          created_by?: string | null
          evidence_source?: string | null
          id?: string
          importance?: string | null
          mapping_source: string
          skill_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          evidence_source?: string | null
          id?: string
          importance?: string | null
          mapping_source?: string
          skill_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_skill_mappings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_skill_mappings_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      course_units: {
        Row: {
          course_id: string
          created_at: string
          hours: number | null
          id: string
          title: string
          unit_no: number
        }
        Insert: {
          course_id: string
          created_at?: string
          hours?: number | null
          id?: string
          title: string
          unit_no: number
        }
        Update: {
          course_id?: string
          created_at?: string
          hours?: number | null
          id?: string
          title?: string
          unit_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_units_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string | null
          course_code: string | null
          created_at: string
          credits: number | null
          deleted_at: string | null
          id: string
          import_id: string
          is_elective: boolean
          is_lab: boolean
          kind: string
          lecture_hours: number | null
          legacy_subject_id: string | null
          objectives: string[]
          online_resources: string[] | null
          practical_hours: number | null
          prerequisite_course_ids: string[]
          prerequisites: string | null
          provenance: Json | null
          reference_books: string[] | null
          semester: number | null
          sort_order: number
          textbooks: string[] | null
          title: string
          tutorial_hours: number | null
          updated_at: string
          year: number
        }
        Insert: {
          category?: string | null
          course_code?: string | null
          created_at?: string
          credits?: number | null
          deleted_at?: string | null
          id?: string
          import_id: string
          is_elective?: boolean
          is_lab?: boolean
          kind?: string
          lecture_hours?: number | null
          legacy_subject_id?: string | null
          objectives?: string[]
          online_resources?: string[] | null
          practical_hours?: number | null
          prerequisite_course_ids?: string[]
          prerequisites?: string | null
          provenance?: Json | null
          reference_books?: string[] | null
          semester?: number | null
          sort_order?: number
          textbooks?: string[] | null
          title: string
          tutorial_hours?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          category?: string | null
          course_code?: string | null
          created_at?: string
          credits?: number | null
          deleted_at?: string | null
          id?: string
          import_id?: string
          is_elective?: boolean
          is_lab?: boolean
          kind?: string
          lecture_hours?: number | null
          legacy_subject_id?: string | null
          objectives?: string[]
          online_resources?: string[] | null
          practical_hours?: number | null
          prerequisite_course_ids?: string[]
          prerequisites?: string | null
          provenance?: Json | null
          reference_books?: string[] | null
          semester?: number | null
          sort_order?: number
          textbooks?: string[] | null
          title?: string
          tutorial_hours?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "courses_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "curriculum_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_extractions: {
        Row: {
          branch: string
          chunks_done: number
          chunks_total: number
          created_at: string
          created_by: string | null
          error_code: string | null
          file_bytes: number
          file_name: string
          id: string
          import_id: string | null
          institution_id: string
          page_count: number | null
          result: Json | null
          role_key: string
          status: string
          updated_at: string
        }
        Insert: {
          branch: string
          chunks_done?: number
          chunks_total?: number
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          file_bytes: number
          file_name: string
          id?: string
          import_id?: string | null
          institution_id: string
          page_count?: number | null
          result?: Json | null
          role_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch?: string
          chunks_done?: number
          chunks_total?: number
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          file_bytes?: number
          file_name?: string
          id?: string
          import_id?: string | null
          institution_id?: string
          page_count?: number | null
          result?: Json | null
          role_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_extractions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "curriculum_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_extractions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_imports: {
        Row: {
          branch: string
          branch_key: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          extraction_model: string | null
          extraction_summary: Json | null
          extraction_version: string | null
          id: string
          institution_id: string
          program: string | null
          published_at: string | null
          regulation: string | null
          reviewed_by: string | null
          source_file_name: string | null
          status: string
          supersedes_import_id: string | null
          updated_at: string
        }
        Insert: {
          branch: string
          branch_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          extraction_model?: string | null
          extraction_summary?: Json | null
          extraction_version?: string | null
          id?: string
          institution_id: string
          program?: string | null
          published_at?: string | null
          regulation?: string | null
          reviewed_by?: string | null
          source_file_name?: string | null
          status?: string
          supersedes_import_id?: string | null
          updated_at?: string
        }
        Update: {
          branch?: string
          branch_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          extraction_model?: string | null
          extraction_summary?: Json | null
          extraction_version?: string | null
          id?: string
          institution_id?: string
          program?: string | null
          published_at?: string | null
          regulation?: string | null
          reviewed_by?: string | null
          source_file_name?: string | null
          status?: string
          supersedes_import_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_imports_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_imports_supersedes_import_id_fkey"
            columns: ["supersedes_import_id"]
            isOneToOne: false
            referencedRelation: "curriculum_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_subject_skill_map: {
        Row: {
          area_key: string
          confirmed_at: string
          confirmed_by: string | null
          role_key: string
          source: string
          subject_id: string
        }
        Insert: {
          area_key: string
          confirmed_at?: string
          confirmed_by?: string | null
          role_key: string
          source: string
          subject_id: string
        }
        Update: {
          area_key?: string
          confirmed_at?: string
          confirmed_by?: string | null
          role_key?: string
          source?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_subject_skill_map_role_key_area_key_fkey"
            columns: ["role_key", "area_key"]
            isOneToOne: false
            referencedRelation: "arena_skill_areas"
            referencedColumns: ["role_key", "area_key"]
          },
          {
            foreignKeyName: "curriculum_subject_skill_map_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_subject_skill_map_pre048: {
        Row: {
          area_key: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          role_key: string | null
          source: string | null
          subject_id: string | null
        }
        Insert: {
          area_key?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          role_key?: string | null
          source?: string | null
          subject_id?: string | null
        }
        Update: {
          area_key?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          role_key?: string | null
          source?: string | null
          subject_id?: string | null
        }
        Relationships: []
      }
      curriculum_subjects: {
        Row: {
          branch: string
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          institution_id: string
          name: string
          semester: number | null
          year: number
        }
        Insert: {
          branch: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id: string
          name: string
          semester?: number | null
          year: number
        }
        Update: {
          branch?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string
          name?: string
          semester?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_subjects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_subjects_pre048: {
        Row: {
          branch: string | null
          code: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          institution_id: string | null
          name: string | null
          semester: number | null
          year: number | null
        }
        Insert: {
          branch?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          institution_id?: string | null
          name?: string | null
          semester?: number | null
          year?: number | null
        }
        Update: {
          branch?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          institution_id?: string | null
          name?: string | null
          semester?: number | null
          year?: number | null
        }
        Relationships: []
      }
      curriculum_versions: {
        Row: {
          branch_key: string
          created_at: string
          id: string
          import_id: string
          institution_id: string
          published_by: string | null
          regulation: string | null
          version_no: number
        }
        Insert: {
          branch_key: string
          created_at?: string
          id?: string
          import_id: string
          institution_id: string
          published_by?: string | null
          regulation?: string | null
          version_no: number
        }
        Update: {
          branch_key?: string
          created_at?: string
          id?: string
          import_id?: string
          institution_id?: string
          published_by?: string | null
          regulation?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_versions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: true
            referencedRelation: "curriculum_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_versions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          analysis_version: string | null
          capability_delta: number | null
          confidence: Database["public"]["Enums"]["capability_confidence"]
          created_at: string
          evaluated_by: string | null
          evidence_type: string | null
          id: string
          metadata: Json | null
          observed_at: string | null
          skill: string
          source_id: string | null
          source_identifier: string | null
          source_type: Database["public"]["Enums"]["capability_evidence_source"]
          source_url: string | null
          strength: number | null
          user_id: string
        }
        Insert: {
          analysis_version?: string | null
          capability_delta?: number | null
          confidence?: Database["public"]["Enums"]["capability_confidence"]
          created_at?: string
          evaluated_by?: string | null
          evidence_type?: string | null
          id?: string
          metadata?: Json | null
          observed_at?: string | null
          skill: string
          source_id?: string | null
          source_identifier?: string | null
          source_type: Database["public"]["Enums"]["capability_evidence_source"]
          source_url?: string | null
          strength?: number | null
          user_id: string
        }
        Update: {
          analysis_version?: string | null
          capability_delta?: number | null
          confidence?: Database["public"]["Enums"]["capability_confidence"]
          created_at?: string
          evaluated_by?: string | null
          evidence_type?: string | null
          id?: string
          metadata?: Json | null
          observed_at?: string | null
          skill?: string
          source_id?: string | null
          source_identifier?: string | null
          source_type?: Database["public"]["Enums"]["capability_evidence_source"]
          source_url?: string | null
          strength?: number | null
          user_id?: string
        }
        Relationships: []
      }
      executive_context: {
        Row: {
          capability_framework: Json
          created_at: string
          leadership_goals: Json
          organisation_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          capability_framework?: Json
          created_at?: string
          leadership_goals?: Json
          organisation_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          capability_framework?: Json
          created_at?: string
          leadership_goals?: Json
          organisation_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_context_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      github_analysis_runs: {
        Row: {
          analysis_version: string
          commits_analyzed: number | null
          completed_at: string | null
          error: string | null
          id: string
          prs_analyzed: number | null
          repos_analyzed: number | null
          repos_discovered: number | null
          repos_failed: number | null
          started_at: string
          status: string
          user_id: string
          warnings: Json
        }
        Insert: {
          analysis_version: string
          commits_analyzed?: number | null
          completed_at?: string | null
          error?: string | null
          id?: string
          prs_analyzed?: number | null
          repos_analyzed?: number | null
          repos_discovered?: number | null
          repos_failed?: number | null
          started_at?: string
          status?: string
          user_id: string
          warnings?: Json
        }
        Update: {
          analysis_version?: string
          commits_analyzed?: number | null
          completed_at?: string | null
          error?: string | null
          id?: string
          prs_analyzed?: number | null
          repos_analyzed?: number | null
          repos_discovered?: number | null
          repos_failed?: number | null
          started_at?: string
          status?: string
          user_id?: string
          warnings?: Json
        }
        Relationships: []
      }
      github_connections: {
        Row: {
          analysis: Json | null
          code_dna_score: number | null
          confidence_level: string | null
          consecutive_failures: number
          created_at: string
          last_scan_error: string | null
          last_scanned_at: string | null
          next_scan_at: string | null
          profile_url: string
          recruiter_summary: string | null
          repositories_analyzed: number | null
          scan_status: string
          updated_at: string
          user_id: string
          username: string
          verification_code: string
          verification_state: string
        }
        Insert: {
          analysis?: Json | null
          code_dna_score?: number | null
          confidence_level?: string | null
          consecutive_failures?: number
          created_at?: string
          last_scan_error?: string | null
          last_scanned_at?: string | null
          next_scan_at?: string | null
          profile_url: string
          recruiter_summary?: string | null
          repositories_analyzed?: number | null
          scan_status?: string
          updated_at?: string
          user_id: string
          username: string
          verification_code: string
          verification_state?: string
        }
        Update: {
          analysis?: Json | null
          code_dna_score?: number | null
          confidence_level?: string | null
          consecutive_failures?: number
          created_at?: string
          last_scan_error?: string | null
          last_scanned_at?: string | null
          next_scan_at?: string | null
          profile_url?: string
          recruiter_summary?: string | null
          repositories_analyzed?: number | null
          scan_status?: string
          updated_at?: string
          user_id?: string
          username?: string
          verification_code?: string
          verification_state?: string
        }
        Relationships: []
      }
      github_repositories: {
        Row: {
          candidate_commit_count: number
          candidate_pr_count: number
          candidate_pr_merged_count: number
          contributors_count: number | null
          description: string | null
          first_candidate_commit_at: string | null
          fork_source_full_name: string | null
          fork_source_url: string | null
          forks_count: number
          full_name: string
          has_auth_signal: boolean
          has_ci: boolean
          has_database_signal: boolean
          has_dependencies: boolean
          has_readme: boolean
          has_tests: boolean
          html_url: string
          id: string
          is_archived: boolean
          is_fork: boolean
          languages: Json
          last_candidate_commit_at: string | null
          license: string | null
          name: string
          primary_language: string | null
          repo_created_at: string | null
          repo_updated_at: string | null
          scan_error: string | null
          scan_status: string
          scanned_at: string
          size_kb: number
          stars: number
          tech_signals: string[]
          top_contributors: Json
          topics: string[]
          user_id: string
        }
        Insert: {
          candidate_commit_count?: number
          candidate_pr_count?: number
          candidate_pr_merged_count?: number
          contributors_count?: number | null
          description?: string | null
          first_candidate_commit_at?: string | null
          fork_source_full_name?: string | null
          fork_source_url?: string | null
          forks_count?: number
          full_name: string
          has_auth_signal?: boolean
          has_ci?: boolean
          has_database_signal?: boolean
          has_dependencies?: boolean
          has_readme?: boolean
          has_tests?: boolean
          html_url: string
          id?: string
          is_archived?: boolean
          is_fork?: boolean
          languages?: Json
          last_candidate_commit_at?: string | null
          license?: string | null
          name: string
          primary_language?: string | null
          repo_created_at?: string | null
          repo_updated_at?: string | null
          scan_error?: string | null
          scan_status?: string
          scanned_at?: string
          size_kb?: number
          stars?: number
          tech_signals?: string[]
          top_contributors?: Json
          topics?: string[]
          user_id: string
        }
        Update: {
          candidate_commit_count?: number
          candidate_pr_count?: number
          candidate_pr_merged_count?: number
          contributors_count?: number | null
          description?: string | null
          first_candidate_commit_at?: string | null
          fork_source_full_name?: string | null
          fork_source_url?: string | null
          forks_count?: number
          full_name?: string
          has_auth_signal?: boolean
          has_ci?: boolean
          has_database_signal?: boolean
          has_dependencies?: boolean
          has_readme?: boolean
          has_tests?: boolean
          html_url?: string
          id?: string
          is_archived?: boolean
          is_fork?: boolean
          languages?: Json
          last_candidate_commit_at?: string | null
          license?: string | null
          name?: string
          primary_language?: string | null
          repo_created_at?: string | null
          repo_updated_at?: string | null
          scan_error?: string | null
          scan_status?: string
          scanned_at?: string
          size_kb?: number
          stars?: number
          tech_signals?: string[]
          top_contributors?: Json
          topics?: string[]
          user_id?: string
        }
        Relationships: []
      }
      github_similarity_signals: {
        Row: {
          affected_area: string | null
          detected_at: string
          id: string
          matched_repo_full_name: string
          matched_repo_url: string
          possible_explanations: string[]
          repository_id: string
          similarity_level: string
        }
        Insert: {
          affected_area?: string | null
          detected_at?: string
          id?: string
          matched_repo_full_name: string
          matched_repo_url: string
          possible_explanations?: string[]
          repository_id: string
          similarity_level: string
        }
        Update: {
          affected_area?: string | null
          detected_at?: string
          id?: string
          matched_repo_full_name?: string
          matched_repo_url?: string
          possible_explanations?: string[]
          repository_id?: string
          similarity_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_similarity_signals_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "github_repositories"
            referencedColumns: ["id"]
          },
        ]
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
          active_role_key: string | null
          branch: string | null
          cohort_id: string | null
          created_at: string
          degree: string | null
          end_year: number | null
          field_of_study: string | null
          goal_state: string | null
          goal_state_prompted_at: string | null
          goal_state_updated_at: string | null
          higher_studies_checkin_at: string | null
          id: string
          institution_id: string
          permissions: string[] | null
          portfolio_prompt_seen_at: string | null
          regulation: string | null
          roll_number: string | null
          roll_number_due_at: string | null
          roll_number_status: string
          role: Database["public"]["Enums"]["app_role"]
          start_year: number | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
          year: string | null
          year_confirmed_at: string | null
          year_override: number | null
        }
        Insert: {
          active_role_key?: string | null
          branch?: string | null
          cohort_id?: string | null
          created_at?: string
          degree?: string | null
          end_year?: number | null
          field_of_study?: string | null
          goal_state?: string | null
          goal_state_prompted_at?: string | null
          goal_state_updated_at?: string | null
          higher_studies_checkin_at?: string | null
          id?: string
          institution_id: string
          permissions?: string[] | null
          portfolio_prompt_seen_at?: string | null
          regulation?: string | null
          roll_number?: string | null
          roll_number_due_at?: string | null
          roll_number_status?: string
          role: Database["public"]["Enums"]["app_role"]
          start_year?: number | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
          year?: string | null
          year_confirmed_at?: string | null
          year_override?: number | null
        }
        Update: {
          active_role_key?: string | null
          branch?: string | null
          cohort_id?: string | null
          created_at?: string
          degree?: string | null
          end_year?: number | null
          field_of_study?: string | null
          goal_state?: string | null
          goal_state_prompted_at?: string | null
          goal_state_updated_at?: string | null
          higher_studies_checkin_at?: string | null
          id?: string
          institution_id?: string
          permissions?: string[] | null
          portfolio_prompt_seen_at?: string | null
          regulation?: string | null
          roll_number?: string | null
          roll_number_due_at?: string | null
          roll_number_status?: string
          role?: Database["public"]["Enums"]["app_role"]
          start_year?: number | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
          year?: string | null
          year_confirmed_at?: string | null
          year_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_memberships_active_role_key_fkey"
            columns: ["active_role_key"]
            isOneToOne: false
            referencedRelation: "arena_domain_roles"
            referencedColumns: ["role_key"]
          },
          {
            foreignKeyName: "institution_memberships_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
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
          academic_start_month: number
          city: string | null
          college_code: string | null
          college_type: Database["public"]["Enums"]["college_type"]
          created_at: string
          id: string
          name: string
          org_type: string
          slug: string
          state: string | null
          updated_at: string
        }
        Insert: {
          academic_start_month?: number
          city?: string | null
          college_code?: string | null
          college_type?: Database["public"]["Enums"]["college_type"]
          created_at?: string
          id?: string
          name: string
          org_type?: string
          slug: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          academic_start_month?: number
          city?: string | null
          college_code?: string | null
          college_type?: Database["public"]["Enums"]["college_type"]
          created_at?: string
          id?: string
          name?: string
          org_type?: string
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
      journey_phases: {
        Row: {
          axis: Database["public"]["Enums"]["journey_axis"]
          created_at: string
          id: string
          key: string
          label: string
          sequence: number
          template_id: string
        }
        Insert: {
          axis: Database["public"]["Enums"]["journey_axis"]
          created_at?: string
          id?: string
          key: string
          label: string
          sequence: number
          template_id: string
        }
        Update: {
          axis?: Database["public"]["Enums"]["journey_axis"]
          created_at?: string
          id?: string
          key?: string
          label?: string
          sequence?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_phases_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "journey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_templates: {
        Row: {
          config: Json
          created_at: string
          entry_semester: string
          id: string
          institution_id: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          entry_semester: string
          id?: string
          institution_id?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          entry_semester?: string
          id?: string
          institution_id?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_templates_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_experiments: {
        Row: {
          course_id: string
          created_at: string
          id: string
          sort_order: number
          text: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          sort_order?: number
          text: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_experiments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_catalog: {
        Row: {
          created_at: string
          estimated_hours: number | null
          id: string
          is_active: boolean
          level_from: number
          level_to: number
          prerequisites: string[]
          provider: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          level_from: number
          level_to: number
          prerequisites?: string[]
          provider: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          level_from?: number
          level_to?: number
          prerequisites?: string[]
          provider?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      learning_item_skills: {
        Row: {
          item_id: string
          skill_id: string
        }
        Insert: {
          item_id: string
          skill_id: string
        }
        Update: {
          item_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_item_skills_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "learning_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_item_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_evaluations: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          mentor_id: string
          project_id: string | null
          score: number | null
          skill: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          mentor_id: string
          project_id?: string | null
          score?: number | null
          skill?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          mentor_id?: string
          project_id?: string | null
          score?: number | null
          skill?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          company: string
          created_at: string
          created_by: string | null
          ctc_offered: string | null
          deadline: string | null
          drive_date: string | null
          drive_status: string
          eligibility: string | null
          eligible_branches: string[] | null
          id: string
          institution_id: string | null
          location: string | null
          opportunity_type: string
          recruiter_id: string | null
          role: string
          skills: Json
        }
        Insert: {
          company: string
          created_at?: string
          created_by?: string | null
          ctc_offered?: string | null
          deadline?: string | null
          drive_date?: string | null
          drive_status?: string
          eligibility?: string | null
          eligible_branches?: string[] | null
          id?: string
          institution_id?: string | null
          location?: string | null
          opportunity_type: string
          recruiter_id?: string | null
          role: string
          skills?: Json
        }
        Update: {
          company?: string
          created_at?: string
          created_by?: string | null
          ctc_offered?: string | null
          deadline?: string | null
          drive_date?: string | null
          drive_status?: string
          eligibility?: string | null
          eligible_branches?: string[] | null
          id?: string
          institution_id?: string | null
          location?: string | null
          opportunity_type?: string
          recruiter_id?: string | null
          role?: string
          skills?: Json
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "recruiters"
            referencedColumns: ["id"]
          },
        ]
      }
      org_chat_channel_members: {
        Row: {
          added_at: string
          channel_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          channel_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          channel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_chat_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "org_chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_chat_channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_chat_channels: {
        Row: {
          created_at: string
          created_by_membership_id: string | null
          description: string | null
          id: string
          institution_id: string
          is_private: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id?: string | null
          description?: string | null
          id?: string
          institution_id: string
          is_private?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string | null
          description?: string | null
          id?: string
          institution_id?: string
          is_private?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_chat_channels_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_chat_channels_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_chat_messages: {
        Row: {
          author_user_id: string | null
          body: string
          channel_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          channel_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          channel_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_chat_messages_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "org_chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      org_chat_reads: {
        Row: {
          channel_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_chat_reads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "org_chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_event_rsvps: {
        Row: {
          post_id: string
          rsvped_at: string
          user_id: string
        }
        Insert: {
          post_id: string
          rsvped_at?: string
          user_id: string
        }
        Update: {
          post_id?: string
          rsvped_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_event_rsvps_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "org_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_follows: {
        Row: {
          followed_at: string
          institution_id: string
          user_id: string
        }
        Insert: {
          followed_at?: string
          institution_id: string
          user_id: string
        }
        Update: {
          followed_at?: string
          institution_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_follows_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          institution_id: string
          invited_by_membership_id: string | null
          permissions: string[] | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          institution_id: string
          invited_by_membership_id?: string | null
          permissions?: string[] | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          institution_id?: string
          invited_by_membership_id?: string | null
          permissions?: string[] | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invitations_accepted_user_id_fkey"
            columns: ["accepted_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_invitations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_invitations_invited_by_membership_id_fkey"
            columns: ["invited_by_membership_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      org_join_link_uses: {
        Row: {
          join_link_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          join_link_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          join_link_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_join_link_uses_join_link_id_fkey"
            columns: ["join_link_id"]
            isOneToOne: false
            referencedRelation: "org_join_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_join_link_uses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_join_links: {
        Row: {
          active: boolean
          branch: string | null
          code: string
          created_at: string
          created_by_membership_id: string | null
          end_year: number | null
          id: string
          institution_id: string
          label: string | null
        }
        Insert: {
          active?: boolean
          branch?: string | null
          code: string
          created_at?: string
          created_by_membership_id?: string | null
          end_year?: number | null
          id?: string
          institution_id: string
          label?: string | null
        }
        Update: {
          active?: boolean
          branch?: string | null
          code?: string
          created_at?: string
          created_by_membership_id?: string | null
          end_year?: number | null
          id?: string
          institution_id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_join_links_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_join_links_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_placements: {
        Row: {
          company: string
          confirmed_at: string
          confirmed_by_membership_id: string | null
          ctc_lpa: number | null
          id: string
          institution_id: string
          offer_date: string | null
          offer_letter_path: string | null
          opportunity_id: string | null
          responded_at: string | null
          role_title: string
          show_on_wall: boolean
          student_response: string
          student_user_id: string
        }
        Insert: {
          company: string
          confirmed_at?: string
          confirmed_by_membership_id?: string | null
          ctc_lpa?: number | null
          id?: string
          institution_id: string
          offer_date?: string | null
          offer_letter_path?: string | null
          opportunity_id?: string | null
          responded_at?: string | null
          role_title: string
          show_on_wall?: boolean
          student_response?: string
          student_user_id: string
        }
        Update: {
          company?: string
          confirmed_at?: string
          confirmed_by_membership_id?: string | null
          ctc_lpa?: number | null
          id?: string
          institution_id?: string
          offer_date?: string | null
          offer_letter_path?: string | null
          opportunity_id?: string | null
          responded_at?: string | null
          role_title?: string
          show_on_wall?: boolean
          student_response?: string
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_placements_confirmed_by_membership_id_fkey"
            columns: ["confirmed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_placements_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_placements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_placements_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_post_likes: {
        Row: {
          liked_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          liked_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          liked_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "org_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_posts: {
        Row: {
          author_membership_id: string
          body: string
          cover_image_url: string | null
          created_at: string
          event_link: string | null
          event_location: string | null
          event_starts_at: string | null
          id: string
          institution_id: string
          is_public: boolean
          published_at: string | null
          status: string
          title: string
          type: string
        }
        Insert: {
          author_membership_id: string
          body: string
          cover_image_url?: string | null
          created_at?: string
          event_link?: string | null
          event_location?: string | null
          event_starts_at?: string | null
          id?: string
          institution_id: string
          is_public?: boolean
          published_at?: string | null
          status?: string
          title: string
          type: string
        }
        Update: {
          author_membership_id?: string
          body?: string
          cover_image_url?: string | null
          created_at?: string
          event_link?: string | null
          event_location?: string | null
          event_starts_at?: string | null
          id?: string
          institution_id?: string
          is_public?: boolean
          published_at?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_posts_author_membership_id_fkey"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_posts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_profiles: {
        Row: {
          bio: string | null
          cover_image_url: string | null
          founded_year: number | null
          institution_id: string
          is_public: boolean
          logo_url: string | null
          tagline: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          bio?: string | null
          cover_image_url?: string | null
          founded_year?: number | null
          institution_id: string
          is_public?: boolean
          logo_url?: string | null
          tagline?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          bio?: string | null
          cover_image_url?: string | null
          founded_year?: number | null
          institution_id?: string
          is_public?: boolean
          logo_url?: string | null
          tagline?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      other_curriculum_items: {
        Row: {
          created_at: string
          details: string | null
          id: string
          import_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          import_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          import_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "other_curriculum_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "curriculum_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_b_explorations: {
        Row: {
          career_concepts: Json
          created_at: string
          extracted_interests: Json
          id: string
          raw_input: string
          skill_gaps: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          career_concepts?: Json
          created_at?: string
          extracted_interests?: Json
          id?: string
          raw_input: string
          skill_gaps?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          career_concepts?: Json
          created_at?: string
          extracted_interests?: Json
          id?: string
          raw_input?: string
          skill_gaps?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      professional_context: {
        Row: {
          created_at: string
          current_job_role: string | null
          organisation_id: string | null
          started_at: string | null
          target_job_role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_job_role?: string | null
          organisation_id?: string | null
          started_at?: string | null
          target_job_role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_job_role?: string | null
          organisation_id?: string | null
          started_at?: string | null
          target_job_role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_context_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "institutions"
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
          has_seen_career_direction_intro: boolean
          id: string
          portfolio_public: boolean
          portfolio_slug: string | null
          primary_role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          has_seen_career_direction_intro?: boolean
          id: string
          portfolio_public?: boolean
          portfolio_slug?: string | null
          primary_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          has_seen_career_direction_intro?: boolean
          id?: string
          portfolio_public?: boolean
          portfolio_slug?: string | null
          primary_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      program_outcomes: {
        Row: {
          code: string
          created_at: string
          id: string
          import_id: string
          kind: string
          sort_order: number
          text: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          import_id: string
          kind: string
          sort_order?: number
          text: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          import_id?: string
          kind?: string
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_outcomes_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "curriculum_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          difficulty: string
          expected_evidence: string[]
          for_student_id: string | null
          id: string
          institution_id: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          difficulty: string
          expected_evidence?: string[]
          for_student_id?: string | null
          id?: string
          institution_id?: string | null
          source: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          difficulty?: string
          expected_evidence?: string[]
          for_student_id?: string | null
          id?: string
          institution_id?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_catalog_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contributions: {
        Row: {
          created_at: string
          description: string
          evaluated_score: number | null
          evaluator_id: string | null
          id: string
          milestone_id: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          evaluated_score?: number | null
          evaluator_id?: string | null
          id?: string
          milestone_id?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          evaluated_score?: number | null
          evaluator_id?: string | null
          id?: string
          milestone_id?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contributions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          joined_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          joined_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          created_at: string
          due_at: string | null
          id: string
          project_id: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          due_at?: string | null
          id?: string
          project_id: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          due_at?: string | null
          id?: string
          project_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_skills: {
        Row: {
          project_id: string
          skill_id: string
        }
        Insert: {
          project_id: string
          skill_id: string
        }
        Update: {
          project_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_skills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          mentor_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          mentor_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          mentor_id?: string | null
          status?: string
          title?: string
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
          correct_option: string | null
          difficulty: number
          domain: string
          expected_output: string | null
          id: string
          language: string | null
          options: Json | null
          question_kind: string
          question_text: string
          section: Database["public"]["Enums"]["assessment_section"]
          skill: string
          starter_code: string | null
          stdin: string | null
        }
        Insert: {
          active?: boolean
          branches?: string[] | null
          capability: string
          college_type?: Database["public"]["Enums"]["college_type"] | null
          correct_option?: string | null
          difficulty?: number
          domain: string
          expected_output?: string | null
          id?: string
          language?: string | null
          options?: Json | null
          question_kind?: string
          question_text: string
          section: Database["public"]["Enums"]["assessment_section"]
          skill: string
          starter_code?: string | null
          stdin?: string | null
        }
        Update: {
          active?: boolean
          branches?: string[] | null
          capability?: string
          college_type?: Database["public"]["Enums"]["college_type"] | null
          correct_option?: string | null
          difficulty?: number
          domain?: string
          expected_output?: string | null
          id?: string
          language?: string | null
          options?: Json | null
          question_kind?: string
          question_text?: string
          section?: Database["public"]["Enums"]["assessment_section"]
          skill?: string
          starter_code?: string | null
          stdin?: string | null
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          hit_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          hit_count?: number
          user_id: string
          window_start: string
        }
        Update: {
          bucket?: string
          hit_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      recruiters: {
        Row: {
          company_name: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_name: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      roadmap_arena_challenges: {
        Row: {
          challenge_id: string | null
          covered_skill_ids: string[]
          difficulty: string
          title: string
          version_id: string
        }
        Insert: {
          challenge_id?: string | null
          covered_skill_ids?: string[]
          difficulty: string
          title: string
          version_id: string
        }
        Update: {
          challenge_id?: string | null
          covered_skill_ids?: string[]
          difficulty?: string
          title?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_arena_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arena_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_arena_challenges_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "roadmap_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_certifications: {
        Row: {
          certification_id: string | null
          covered_skill_ids: string[]
          name: string
          provider: string
          relevance: string
          url: string | null
          version_id: string
        }
        Insert: {
          certification_id?: string | null
          covered_skill_ids?: string[]
          name: string
          provider: string
          relevance: string
          url?: string | null
          version_id: string
        }
        Update: {
          certification_id?: string | null
          covered_skill_ids?: string[]
          name?: string
          provider?: string
          relevance?: string
          url?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_certifications_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certification_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_certifications_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "roadmap_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_courses: {
        Row: {
          ai_explanation: string | null
          course_id: string | null
          facts: Json
          schedule: string
          score: number
          semester: number | null
          sort_order: number
          stars: number
          tier: string
          title: string
          version_id: string
          year: number
        }
        Insert: {
          ai_explanation?: string | null
          course_id?: string | null
          facts: Json
          schedule: string
          score: number
          semester?: number | null
          sort_order: number
          stars: number
          tier: string
          title: string
          version_id: string
          year: number
        }
        Update: {
          ai_explanation?: string | null
          course_id?: string | null
          facts?: Json
          schedule?: string
          score?: number
          semester?: number | null
          sort_order?: number
          stars?: number
          tier?: string
          title?: string
          version_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_courses_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "roadmap_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_goals: {
        Row: {
          career_id: string | null
          career_name: string
          kind: string
          readiness: number | null
          version_id: string
        }
        Insert: {
          career_id?: string | null
          career_name: string
          kind: string
          readiness?: number | null
          version_id: string
        }
        Update: {
          career_id?: string | null
          career_name?: string
          kind?: string
          readiness?: number | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_goals_career_id_fkey"
            columns: ["career_id"]
            isOneToOne: false
            referencedRelation: "careers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_goals_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "roadmap_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_learning_items: {
        Row: {
          estimated_hours: number | null
          learning_item_id: string | null
          level_from: number
          level_to: number
          provider: string
          reason: string
          skill_id: string | null
          skill_name: string
          starts_now: boolean
          title: string
          url: string | null
          version_id: string
        }
        Insert: {
          estimated_hours?: number | null
          learning_item_id?: string | null
          level_from: number
          level_to: number
          provider: string
          reason: string
          skill_id?: string | null
          skill_name: string
          starts_now: boolean
          title: string
          url?: string | null
          version_id: string
        }
        Update: {
          estimated_hours?: number | null
          learning_item_id?: string | null
          level_from?: number
          level_to?: number
          provider?: string
          reason?: string
          skill_id?: string | null
          skill_name?: string
          starts_now?: boolean
          title?: string
          url?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_learning_items_learning_item_id_fkey"
            columns: ["learning_item_id"]
            isOneToOne: false
            referencedRelation: "learning_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_learning_items_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_learning_items_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "roadmap_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_milestones: {
        Row: {
          blocked_by_skill_id: string | null
          horizon: string
          kind: string
          optional_exploration: boolean
          reason: string
          ref_id: string | null
          sort_order: number
          status: string
          title: string
          version_id: string
        }
        Insert: {
          blocked_by_skill_id?: string | null
          horizon: string
          kind: string
          optional_exploration?: boolean
          reason: string
          ref_id?: string | null
          sort_order: number
          status: string
          title: string
          version_id: string
        }
        Update: {
          blocked_by_skill_id?: string | null
          horizon?: string
          kind?: string
          optional_exploration?: boolean
          reason?: string
          ref_id?: string | null
          sort_order?: number
          status?: string
          title?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_milestones_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "roadmap_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_projects: {
        Row: {
          covered_skill_ids: string[]
          difficulty: string
          is_ai_recommendation: boolean
          project_id: string | null
          status: string
          title: string
          version_id: string
        }
        Insert: {
          covered_skill_ids?: string[]
          difficulty: string
          is_ai_recommendation?: boolean
          project_id?: string | null
          status?: string
          title: string
          version_id: string
        }
        Update: {
          covered_skill_ids?: string[]
          difficulty?: string
          is_ai_recommendation?: boolean
          project_id?: string | null
          status?: string
          title?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_projects_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "roadmap_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_skill_gaps: {
        Row: {
          blocked_by_skill_id: string | null
          confidence: number
          coverage: string
          current_level: number
          gap: number
          gap_type: string | null
          importance: string
          self_declared_only: boolean
          skill_id: string | null
          skill_name: string
          sort_order: number
          stage: string
          target_level: number
          verified: boolean
          version_id: string
        }
        Insert: {
          blocked_by_skill_id?: string | null
          confidence?: number
          coverage: string
          current_level: number
          gap: number
          gap_type?: string | null
          importance: string
          self_declared_only?: boolean
          skill_id?: string | null
          skill_name: string
          sort_order: number
          stage: string
          target_level: number
          verified: boolean
          version_id: string
        }
        Update: {
          blocked_by_skill_id?: string | null
          confidence?: number
          coverage?: string
          current_level?: number
          gap?: number
          gap_type?: string | null
          importance?: string
          self_declared_only?: boolean
          skill_id?: string | null
          skill_name?: string
          sort_order?: number
          stage?: string
          target_level?: number
          verified?: boolean
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_skill_gaps_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_skill_gaps_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "roadmap_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_versions: {
        Row: {
          baseline_recommended: boolean
          curriculum_version_id: string | null
          generated_at: string
          id: string
          input_hash: string
          input_snapshot: Json
          mode: string
          next_best_action: Json | null
          notes: Json
          readiness_score: number
          roadmap_id: string
          trigger: string
          version_no: number
        }
        Insert: {
          baseline_recommended?: boolean
          curriculum_version_id?: string | null
          generated_at?: string
          id?: string
          input_hash: string
          input_snapshot: Json
          mode?: string
          next_best_action?: Json | null
          notes?: Json
          readiness_score: number
          roadmap_id: string
          trigger: string
          version_no: number
        }
        Update: {
          baseline_recommended?: boolean
          curriculum_version_id?: string | null
          generated_at?: string
          id?: string
          input_hash?: string
          input_snapshot?: Json
          mode?: string
          next_best_action?: Json | null
          notes?: Json
          readiness_score?: number
          roadmap_id?: string
          trigger?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_versions_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_versions_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmaps: {
        Row: {
          branch_key: string | null
          career_id: string
          created_at: string
          curriculum_version_id: string | null
          id: string
          institution_id: string | null
          is_current: boolean
          student_id: string
          updated_at: string
        }
        Insert: {
          branch_key?: string | null
          career_id: string
          created_at?: string
          curriculum_version_id?: string | null
          id?: string
          institution_id?: string | null
          is_current?: boolean
          student_id: string
          updated_at?: string
        }
        Update: {
          branch_key?: string | null
          career_id?: string
          created_at?: string
          curriculum_version_id?: string | null
          id?: string
          institution_id?: string | null
          is_current?: boolean
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmaps_career_id_fkey"
            columns: ["career_id"]
            isOneToOne: false
            referencedRelation: "careers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmaps_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmaps_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action: string
          resource: string
          role_id: string
        }
        Insert: {
          action: string
          resource: string
          role_id: string
        }
        Update: {
          action?: string
          resource?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_target_profiles: {
        Row: {
          area_key: string
          min_verified_count: number
          role_key: string
        }
        Insert: {
          area_key: string
          min_verified_count: number
          role_key: string
        }
        Update: {
          area_key?: string
          min_verified_count?: number
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_target_profiles_role_key_area_key_fkey"
            columns: ["role_key", "area_key"]
            isOneToOne: true
            referencedRelation: "arena_skill_areas"
            referencedColumns: ["role_key", "area_key"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          scope: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          scope: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          scope?: string
        }
        Relationships: []
      }
      skill_aliases: {
        Row: {
          alias: string
          created_at: string
          skill_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          skill_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_aliases_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_area_resources: {
        Row: {
          active: boolean
          area_key: string
          created_at: string
          description: string | null
          id: string
          kind: string
          role_key: string
          title: string
          url: string | null
        }
        Insert: {
          active?: boolean
          area_key: string
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          role_key: string
          title: string
          url?: string | null
        }
        Update: {
          active?: boolean
          area_key?: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          role_key?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_area_resources_role_key_area_key_fkey"
            columns: ["role_key", "area_key"]
            isOneToOne: false
            referencedRelation: "arena_skill_areas"
            referencedColumns: ["role_key", "area_key"]
          },
        ]
      }
      skill_suggestions: {
        Row: {
          display_text: string
          first_seen_at: string
          last_seen_at: string
          normalized_text: string
          occurrences: number
          resolved_by: string | null
          resolved_skill_id: string | null
          source: string
          status: string
        }
        Insert: {
          display_text: string
          first_seen_at?: string
          last_seen_at?: string
          normalized_text: string
          occurrences?: number
          resolved_by?: string | null
          resolved_skill_id?: string | null
          source: string
          status?: string
        }
        Update: {
          display_text?: string
          first_seen_at?: string
          last_seen_at?: string
          normalized_text?: string
          occurrences?: number
          resolved_by?: string | null
          resolved_skill_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_suggestions_resolved_skill_id_fkey"
            columns: ["resolved_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          domain: string | null
          id: string
          key: string | null
          level_definition: Json | null
          name: string
          parent_skill_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          key?: string | null
          level_definition?: Json | null
          name: string
          parent_skill_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          key?: string | null
          level_definition?: Json | null
          name?: string
          parent_skill_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_parent_skill_id_fkey"
            columns: ["parent_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      student_career_intent: {
        Row: {
          career_goal_confidence: number | null
          career_goal_text: string | null
          is_exploring: boolean
          last_updated: string
          primary_career_id: string | null
          secondary_career_id: string | null
          student_id: string
        }
        Insert: {
          career_goal_confidence?: number | null
          career_goal_text?: string | null
          is_exploring?: boolean
          last_updated?: string
          primary_career_id?: string | null
          secondary_career_id?: string | null
          student_id: string
        }
        Update: {
          career_goal_confidence?: number | null
          career_goal_text?: string | null
          is_exploring?: boolean
          last_updated?: string
          primary_career_id?: string | null
          secondary_career_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_career_intent_primary_career_id_fkey"
            columns: ["primary_career_id"]
            isOneToOne: false
            referencedRelation: "careers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_career_intent_secondary_career_id_fkey"
            columns: ["secondary_career_id"]
            isOneToOne: false
            referencedRelation: "careers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_journey_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          student_journey_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          student_journey_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          student_journey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_journey_events_student_journey_id_fkey"
            columns: ["student_journey_id"]
            isOneToOne: false
            referencedRelation: "student_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      student_journeys: {
        Row: {
          current_capability_phase: string
          current_career_phase: string
          id: string
          started_at: string
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_capability_phase: string
          current_career_phase: string
          id?: string
          started_at?: string
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_capability_phase?: string
          current_career_phase?: string
          id?: string
          started_at?: string
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_journeys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "journey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_topics: {
        Row: {
          course_id: string
          created_at: string
          id: string
          sort_order: number
          text: string
          unit_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          sort_order?: number
          text: string
          unit_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          text?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_topics_unit_id_course_id_fkey"
            columns: ["unit_id", "course_id"]
            isOneToOne: false
            referencedRelation: "course_units"
            referencedColumns: ["id", "course_id"]
          },
        ]
      }
      vault_items: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          institution_membership_id: string | null
          item_type: string
          title: string
          url: string | null
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          institution_membership_id?: string | null
          item_type: string
          title: string
          url?: string | null
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          institution_membership_id?: string | null
          item_type?: string
          title?: string
          url?: string | null
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "vault_items_institution_membership_id_fkey"
            columns: ["institution_membership_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id"]
          },
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
      array_dedupe: { Args: { p_arr: string[] }; Returns: string[] }
      class_assert_staff_for_project: {
        Args: {
          p_membership_id: string
          p_project: Database["public"]["Tables"]["class_projects"]["Row"]
        }
        Returns: {
          active_role_key: string | null
          branch: string | null
          cohort_id: string | null
          created_at: string
          degree: string | null
          end_year: number | null
          field_of_study: string | null
          goal_state: string | null
          goal_state_prompted_at: string | null
          goal_state_updated_at: string | null
          higher_studies_checkin_at: string | null
          id: string
          institution_id: string
          permissions: string[] | null
          portfolio_prompt_seen_at: string | null
          regulation: string | null
          role: Database["public"]["Enums"]["app_role"]
          start_year: number | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
          year: string | null
          year_confirmed_at: string | null
          year_override: number | null
        }
        SetofOptions: {
          from: "*"
          to: "institution_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      class_create_group: {
        Args: { p_name: string; p_project_id: string; p_user_id: string }
        Returns: string
      }
      class_grade_group: {
        Args: {
          p_feedback: string
          p_grade: string
          p_group_id: string
          p_membership_id: string
          p_notes: Json
        }
        Returns: string
      }
      class_join_group: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      class_leave_group: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      class_mark_physical_received: {
        Args: { p_group_id: string; p_membership_id: string }
        Returns: undefined
      }
      class_student_branch_for_project: {
        Args: {
          p_project: Database["public"]["Tables"]["class_projects"]["Row"]
          p_user_id: string
        }
        Returns: string
      }
      class_submit_project: {
        Args: { p_group_id: string; p_link: string; p_user_id: string }
        Returns: undefined
      }
      clone_curriculum_import: {
        Args: { p_import_id: string; p_user_id: string }
        Returns: string
      }
      commit_rotation_attempt: {
        Args: {
          p_area_key: string
          p_challenge: Json
          p_expected_version: number
          p_role_key: string
          p_user_id: string
        }
        Returns: Json
      }
      complete_workstation_attempt: {
        Args: {
          p_attempt_id: string
          p_cooldown_hours: number
          p_grade: Json
          p_points: number
          p_streak: Json
          p_submission: Json
        }
        Returns: Json
      }
      create_org_signup: {
        Args: {
          p_org_name: string
          p_org_type: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: {
          institution_id: string
          matched_existing: boolean
          membership_id: string
        }[]
      }
      curriculum_import_is_frozen: {
        Args: { p_import: string }
        Returns: boolean
      }
      finish_arena_challenge: { Args: { p_attempt_id: string }; Returns: Json }
      get_coding_question_for_grading: {
        Args: {
          p_question_index: number
          p_section: Database["public"]["Enums"]["assessment_section"]
        }
        Returns: Json
      }
      get_or_create_institution: {
        Args: { institution_name: string }
        Returns: string
      }
      get_or_start_section: {
        Args: { p_section: Database["public"]["Enums"]["assessment_section"] }
        Returns: Json
      }
      get_public_profiles: {
        Args: { p_ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
      increment_rate_limit: {
        Args: { p_bucket: string; p_user_id: string; p_window_start: string }
        Returns: number
      }
      merge_courses: {
        Args: { p_source: string; p_target: string }
        Returns: undefined
      }
      normalize_skill_text: { Args: { p_text: string }; Returns: string }
      only_dangling_refs_nulled: {
        Args: { n: Json; o: Json }
        Returns: boolean
      }
      org_effective_permissions: {
        Args: {
          p_permissions: string[]
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string[]
      }
      publish_curriculum_import: {
        Args: { p_import_id: string; p_user_id: string }
        Returns: string
      }
      record_arena_answer: {
        Args: {
          p_attempt_id: string
          p_question_index: number
          p_selected_option: string
        }
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
      record_coding_response: {
        Args: {
          p_is_correct: boolean
          p_question_index: number
          p_section: Database["public"]["Enums"]["assessment_section"]
          p_submitted_code: string
        }
        Returns: Json
      }
      replace_course_tree: {
        Args: { p_course_id: string; p_tree: Json }
        Returns: undefined
      }
      role_requires_verification: {
        Args: { role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      save_roadmap_version: { Args: { p: Json }; Returns: Json }
      start_arena_challenge: {
        Args: {
          p_question_count?: number
          p_section: Database["public"]["Enums"]["assessment_section"]
        }
        Returns: Json
      }
      tag_arena_challenge_skills: {
        Args: { p_challenge: string }
        Returns: undefined
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
        | "tpo"
        | "company_admin"
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
        | "github_repository"
      college_type:
        | "engineering"
        | "medical"
        | "management"
        | "arts_science"
        | "pharmacy"
        | "law"
        | "other"
      interview_mode: "practice" | "technical" | "behavioral" | "hr"
      interview_status: "in_progress" | "completed" | "abandoned"
      journey_axis: "capability" | "career"
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
        "tpo",
        "company_admin",
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
        "github_repository",
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
      interview_mode: ["practice", "technical", "behavioral", "hr"],
      interview_status: ["in_progress", "completed", "abandoned"],
      journey_axis: ["capability", "career"],
      membership_status: ["pending", "active", "revoked"],
      section_progress_status: ["not_started", "in_progress", "completed"],
    },
  },
} as const
