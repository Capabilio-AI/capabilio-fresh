-- Placements reframed: companies visit colleges. The college records a confirmed company visit (campus drive);
-- students register; the company selects; the offer letter is released and the college confirms the placement.

alter table public.opportunities add column drive_date date;
alter table public.opportunities add column drive_status text not null default 'registration_open'
  check (drive_status in ('planned', 'registration_open', 'completed', 'cancelled'));
alter table public.opportunities add column ctc_offered text check (char_length(ctc_offered) <= 100);
alter table public.opportunities add column eligible_branches text[];

alter table public.org_placements add column offer_letter_path text check (char_length(offer_letter_path) <= 300);
alter table public.org_placements add column student_response text not null default 'pending'
  check (student_response in ('pending', 'accepted', 'declined'));
alter table public.org_placements add column responded_at timestamptz;

-- Offer letters are private: only the student and the college's officers can open one (signed URL, server-issued).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-offers', 'org-offers', false, 5242880, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;
