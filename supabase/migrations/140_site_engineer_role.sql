-- CIVIL-01 Site Engineer role: a civil fresher's first job, site arithmetic. One workstation (calc_workspace, a calculation worksheet with a formula
-- and stated-factor sheet and seeded site data) serves all six areas with this role's own templates (lib/workplace/calc/site.ts). The server computes
-- each expected number from the ticket's parameters and checks the typed answers within a tolerance. Drawings, CAD, structural software, real code
-- compliance and site safety sign-off are not assessed, and nothing here approves real work.
insert into public.careers (key, name, category, description) values
  ('site-engineer', 'Site Engineer', 'Civil', 'Runs the day-to-day numbers on a construction site: quantities, concrete batching, levels, bills, progress and simple load limits.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('site-engineer', 'Site Engineer', 'Site Engineering', array['site engineer', 'civil site engineer', 'junior site engineer', 'construction site engineer', 'site execution engineer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('site-engineer', 'site-quantities', 'Quantities and take-off', 'site.quantities', 'calc_workspace', true, 1, 'calc.gen.v1', 'calc.grade.v1'),
  ('site-engineer', 'site-concrete-mix', 'Concrete mix and batching', 'site.concrete_mix', 'calc_workspace', true, 2, 'calc.gen.v1', 'calc.grade.v1'),
  ('site-engineer', 'site-levels-and-surveying', 'Levels and surveying', 'site.levels_and_surveying', 'calc_workspace', true, 3, 'calc.gen.v1', 'calc.grade.v1'),
  ('site-engineer', 'site-materials-and-cost', 'Materials and cost', 'site.materials_and_cost', 'calc_workspace', true, 4, 'calc.gen.v1', 'calc.grade.v1'),
  ('site-engineer', 'site-progress-and-planning', 'Progress and planning', 'site.progress_and_planning', 'calc_workspace', true, 5, 'calc.gen.v1', 'calc.grade.v1'),
  ('site-engineer', 'site-safety-calcs', 'Safety calculations', 'site.safety_calcs', 'calc_workspace', true, 6, 'calc.gen.v1', 'calc.grade.v1')
on conflict (role_key, area_key) do nothing;
