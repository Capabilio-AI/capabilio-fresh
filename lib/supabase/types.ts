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
          capability_delta: number | null
          confidence: Database["public"]["Enums"]["capability_confidence"]
          created_at: string
          evaluated_by: string | null
          id: string
          skill: string
          source_id: string | null
          source_type: Database["public"]["Enums"]["capability_evidence_source"]
          user_id: string
        }
        Insert: {
          capability_delta?: number | null
          confidence?: Database["public"]["Enums"]["capability_confidence"]
          created_at?: string
          evaluated_by?: string | null
          id?: string
          skill: string
          source_id?: string | null
          source_type: Database["public"]["Enums"]["capability_evidence_source"]
          user_id: string
        }
        Update: {
          capability_delta?: number | null
          confidence?: Database["public"]["Enums"]["capability_confidence"]
          created_at?: string
          evaluated_by?: string | null
          id?: string
          skill?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["capability_evidence_source"]
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
          branch: string | null
          cohort_id: string | null
          created_at: string
          degree: string | null
          end_year: number | null
          field_of_study: string | null
          id: string
          institution_id: string
          role: Database["public"]["Enums"]["app_role"]
          start_year: number | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
          year: string | null
        }
        Insert: {
          branch?: string | null
          cohort_id?: string | null
          created_at?: string
          degree?: string | null
          end_year?: number | null
          field_of_study?: string | null
          id?: string
          institution_id: string
          role: Database["public"]["Enums"]["app_role"]
          start_year?: number | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
          year?: string | null
        }
        Update: {
          branch?: string | null
          cohort_id?: string | null
          created_at?: string
          degree?: string | null
          end_year?: number | null
          field_of_study?: string | null
          id?: string
          institution_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          start_year?: number | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
          year?: string | null
        }
        Relationships: [
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
          deadline: string | null
          eligibility: string | null
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
          deadline?: string | null
          eligibility?: string | null
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
          deadline?: string | null
          eligibility?: string | null
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
          primary_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
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
      skills: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          name?: string
        }
        Relationships: []
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
      role_requires_verification: {
        Args: { role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      start_arena_challenge: {
        Args: {
          p_question_count?: number
          p_section: Database["public"]["Enums"]["assessment_section"]
        }
        Returns: Json
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
      journey_axis: ["capability", "career"],
      membership_status: ["pending", "active", "revoked"],
      section_progress_status: ["not_started", "in_progress", "completed"],
    },
  },
} as const
