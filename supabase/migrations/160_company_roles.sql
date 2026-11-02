-- Company roles: an approved company posts roles on the same tables Capabilio's own careers page uses.
-- institution_id null = a Capabilio role (shown on /careers); set = that company's role (shown only to signed-in students and the company).
-- user_id is set when a signed-in student applies, so the company can open that student's Skill Passport; public /careers applications leave it null.
-- Still written and read only by the server (service role) after it has checked the caller, so RLS stays on with no policy.
alter table public.job_openings add column if not exists institution_id uuid references public.institutions(id) on delete cascade;
create index if not exists job_openings_institution_idx on public.job_openings (institution_id, status, published_at desc);

alter table public.job_applications add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists job_applications_one_per_student_role
  on public.job_applications (opening_id, user_id) where user_id is not null and opening_id is not null;
create index if not exists job_applications_user_idx on public.job_applications (user_id) where user_id is not null;
