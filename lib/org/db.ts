import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// lib/supabase/types.ts predates migrations 038-040, so the new class_*/org_* tables are reached through an
// untyped view of the same client, with the row shapes declared here. Regenerate types and drop this later.
export type Db = SupabaseClient;
export const untyped = (c: SupabaseClient<Database>): Db => c as unknown as Db;

export interface ProjectRow {
  id: string;
  institution_id: string;
  created_by_membership_id: string;
  subject_id: string | null;
  title: string;
  brief: string;
  department_scope: string[] | null;
  team_size: number;
  submission_type: "in_app" | "physical";
  weekly_report_required: boolean;
  starts_at: string;
  deadline_at: string;
  status: "open" | "closed" | "archived";
  created_at: string;
}
export interface GroupRow {
  id: string;
  project_id: string;
  name: string;
  status: "forming" | "active" | "submitted" | "graded";
  created_by_user_id: string;
  created_at: string;
}
export interface GroupMemberRow {
  id: string;
  group_id: string;
  project_id: string;
  user_id: string;
  branch: string | null;
  role: "lead" | "member";
  joined_at: string;
}
export interface MaterialRow {
  id: string;
  institution_id: string;
  subject_id: string | null;
  author_membership_id: string;
  type: "notes" | "pdf" | "link";
  title: string;
  description: string | null;
  body: string | null;
  url: string | null;
  branch: string;
  year: number;
  published_at: string;
}
export interface ReportRow {
  id: string;
  group_id: string;
  week_number: number;
  submitted_by_user_id: string;
  content: string;
  attachment_url: string | null;
  submitted_at: string;
  staff_feedback: string | null;
  staff_seen_at: string | null;
}
export interface SubmissionRow {
  id: string;
  group_id: string;
  submission_type: "in_app" | "physical";
  link_url: string | null;
  submitted_at: string;
  physical_confirmed_by_membership_id: string | null;
}
export interface GradeRow {
  id: string;
  group_id: string;
  grade: string;
  feedback: string | null;
  member_contribution_notes: Record<string, string>;
  graded_at: string;
}
export interface OrgPostRow {
  id: string;
  institution_id: string;
  author_membership_id: string;
  type: "event" | "announcement";
  title: string;
  body: string;
  cover_image_url: string | null;
  event_starts_at: string | null;
  event_location: string | null;
  event_link: string | null;
  is_public: boolean;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
}
export interface OrgProfileRow {
  institution_id: string;
  bio: string | null;
  cover_image_url: string | null;
  website_url: string | null;
  is_public: boolean;
}
