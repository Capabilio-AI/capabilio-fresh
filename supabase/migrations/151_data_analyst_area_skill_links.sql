-- Data Analyst (IT-01): link every enabled area to the skills it actually proves. Until now 6 of 9 areas had a primary skill (047) and the other
-- three (debugging, investigation, incident) had none, so passing them wrote no skill evidence. Data Analysis, Power BI, Problem Solving and
-- Spreadsheet Formulas were provable by no area at all.
-- An area has one PRIMARY skill (arena_skill_areas.skill_id) and optional extra skills it also proves (arena_area_extra_skills, see 149).
-- The python area stays unlinked and disabled: no isolated executor exists yet.
create table if not exists public.arena_area_extra_skills (
  role_key text not null,
  area_key text not null,
  skill_id uuid not null references public.skills(id) on delete cascade,
  primary key (role_key, area_key, skill_id),
  foreign key (role_key, area_key) references public.arena_skill_areas (role_key, area_key) on delete cascade
);
alter table public.arena_area_extra_skills enable row level security; -- read by the server (service role) only

update public.arena_skill_areas a set skill_id = s.id
from (values
  ('debugging', 'SKILL_SQL'),
  ('investigation', 'SKILL_DATA_ANALYSIS'),
  ('incident', 'SKILL_PROBLEM_SOLVING')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
where a.role_key = 'data-analyst' and a.area_key = m.area_key and a.skill_id is null;

insert into public.arena_area_extra_skills (role_key, area_key, skill_id)
select 'data-analyst', m.area_key, s.id
from (values
  ('sql', 'SKILL_DATA_ANALYSIS'),
  ('debugging', 'SKILL_PROBLEM_SOLVING'),
  ('spreadsheet', 'SKILL_SPREADSHEET_FORMULAS_AND_FUNCTIONS'),
  ('spreadsheet', 'SKILL_DATA_ANALYSIS'),
  ('statistics', 'SKILL_DATA_ANALYSIS'),
  ('data_cleaning', 'SKILL_DATA_ANALYSIS'),
  ('dashboard', 'SKILL_POWER_BI'),
  ('dashboard', 'SKILL_DASHBOARD_DESIGN'),
  ('dashboard', 'SKILL_DATA_STORYTELLING'),
  ('investigation', 'SKILL_PROBLEM_SOLVING'),
  ('investigation', 'SKILL_TECHNICAL_COMMUNICATION'),
  ('investigation', 'SKILL_BUSINESS_ANALYSIS'),
  ('incident', 'SKILL_DATA_ANALYSIS'),
  ('incident', 'SKILL_TECHNICAL_COMMUNICATION')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
on conflict do nothing;
