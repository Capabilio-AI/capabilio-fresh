-- AI / ML Engineer: link the lifecycle areas to the career's own skills where the ticket really exercises them. neural-networks proves Neural Network
-- Fundamentals, the gradient step and (a forward pass is matrix multiplication) Linear Algebra; experiment-tracking proves Experiment Tracking.
-- Additive only; a skill key that does not exist simply links nothing.
insert into public.arena_area_extra_skills (role_key, area_key, skill_id)
select 'ai-ml-engineer', m.area_key, s.id
from (values
  ('neural-networks', 'SKILL_NEURAL_NETWORK_FUNDAMENTALS'),
  ('neural-networks', 'SKILL_OPTIMIZATION_AND_GRADIENT_DESCENT'),
  ('neural-networks', 'SKILL_LINEAR_ALGEBRA'),
  ('experiment-tracking', 'SKILL_EXPERIMENT_TRACKING')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
on conflict do nothing;
