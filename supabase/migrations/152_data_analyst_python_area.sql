-- Data Analyst: switch on the Python area. It was blocked because no isolated executor existed; the in-browser notebook (Pyodide, the ml_workspace tool)
-- needs none, since the student's code runs on their own machine and the server grades only the numbers they report against a key it never ships.
update public.arena_skill_areas
set tool_type = 'ml_workspace', generation_version = 'ml.gen.v1', grading_version = 'ml.grade.v1', enabled = true
where role_key = 'data-analyst' and area_key = 'python';

-- Python practice is also analysis practice (needs 149 and 151 applied first for arena_area_extra_skills).
insert into public.arena_area_extra_skills (role_key, area_key, skill_id)
select 'data-analyst', 'python', s.id from public.skills s where s.key = 'SKILL_DATA_ANALYSIS'
on conflict do nothing;
