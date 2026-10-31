-- Indexes for lookups the app makes on every Pulse / college-workspace / curriculum page and that had none (Supabase performance advisor: unindexed foreign keys).
-- Additive and safe to run any time; `if not exists` keeps it repeatable.
create index if not exists org_follows_user_idx on public.org_follows (user_id);                       -- Pulse feed, "colleges you follow", profile counts
create index if not exists org_post_likes_user_idx on public.org_post_likes (user_id);
create index if not exists org_event_rsvps_user_idx on public.org_event_rsvps (user_id);
create index if not exists org_placements_student_idx on public.org_placements (student_user_id);       -- Outcomes list, student offers
create index if not exists org_placements_opportunity_idx on public.org_placements (opportunity_id);    -- company-visit page
create index if not exists lab_experiments_course_idx on public.lab_experiments (course_id);           -- every curriculum summary and course page
create index if not exists unit_topics_course_idx on public.unit_topics (course_id);
create index if not exists course_outcome_skill_mappings_skill_idx on public.course_outcome_skill_mappings (skill_id);
create index if not exists curriculum_imports_institution_idx on public.curriculum_imports (institution_id, status) where deleted_at is null;
create index if not exists institution_memberships_inst_role_status_idx on public.institution_memberships (institution_id, role, status);   -- every student count and list
