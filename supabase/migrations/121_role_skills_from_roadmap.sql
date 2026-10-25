-- A role's skills live in career_skill_requirements: the role assessment, the Arena skill profile and the role picker all read it, and the
-- picker hides a role that has none. Eight roles (Backend, BI, Data Engineer, DBA, DevOps, Frontend, Programming Languages, SQL Developer)
-- have a published roadmap but no rows, so students of those roles had nothing to be assessed on. Derive their rows from that roadmap:
-- foundation / core / job-ready topics that are core or recommended, never optional or specialization. Weights and question counts follow the
-- same importance rules every other role already uses. Roles that already have rows are left alone; re-running adds nothing.
insert into career_skill_requirements (career_id, skill_id, importance, target_level, required_by_stage, assessment_weight, min_questions, max_questions)
select distinct on (t.career_id, n.skill_id)
  t.career_id,
  n.skill_id,
  case n.importance when 'CORE' then 'HIGH' else 'MEDIUM' end,
  n.target_level,
  case n.stage when 'FOUNDATION' then 'FOUNDATION' when 'CORE' then 'INTERMEDIATE' else 'JOB_READY' end,
  case n.importance when 'CORE' then 3 else 2 end,
  1,
  case n.importance when 'CORE' then 3 else 2 end
from roadmap_templates t
join roadmap_nodes n on n.template_id = t.id and n.type = 'TOPIC'
join skills s on s.id = n.skill_id and s.status = 'active'
where t.status = 'PUBLISHED'
  and n.stage in ('FOUNDATION', 'CORE', 'JOB_READY')
  and n.importance in ('CORE', 'RECOMMENDED')
  and n.target_level is not null
  and not exists (select 1 from career_skill_requirements r where r.career_id = t.career_id)
order by t.career_id, n.skill_id, (n.importance = 'CORE') desc, case n.stage when 'FOUNDATION' then 1 when 'CORE' then 2 else 3 end;
