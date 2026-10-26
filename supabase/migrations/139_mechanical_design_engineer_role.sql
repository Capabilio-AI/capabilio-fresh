-- MECH-01 Mechanical Design Engineer role: a mechanical fresher's first job, hand calculations that support a design. Every area is served by the
-- calculation workstation (calc_workspace) with this role's own templates (lib/workplace/calc/mech.ts): seeded loads and dimensions, a formula
-- reference sheet, results checked within a tolerance. CAD, FEA and drawings are not assessed; tickets are educational, never design approval.
insert into public.careers (key, name, category, description) values
  ('mechanical-design-engineer', 'Mechanical Design Engineer', 'Mechanical', 'Sizes and checks mechanical parts by calculation: loads, stresses, fits and tolerances, power transmission, material choice and fasteners.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('mechanical-design-engineer', 'Mechanical Design Engineer', 'Mechanical Design', array['mechanical design engineer', 'design engineer mechanical', 'mechanical engineer', 'machine design engineer', 'product design engineer', 'mechanical designer', 'cad design engineer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('mechanical-design-engineer', 'mech-statics-and-loads', 'Statics and loads', 'mech.statics_and_loads', 'calc_workspace', true, 1, 'calc.gen.v1', 'calc.grade.v1'),
  ('mechanical-design-engineer', 'mech-stress-and-strength', 'Stress and strength', 'mech.stress_and_strength', 'calc_workspace', true, 2, 'calc.gen.v1', 'calc.grade.v1'),
  ('mechanical-design-engineer', 'mech-fits-and-tolerances', 'Fits and tolerances', 'mech.fits_and_tolerances', 'calc_workspace', true, 3, 'calc.gen.v1', 'calc.grade.v1'),
  ('mechanical-design-engineer', 'mech-power-transmission', 'Power transmission', 'mech.power_transmission', 'calc_workspace', true, 4, 'calc.gen.v1', 'calc.grade.v1'),
  ('mechanical-design-engineer', 'mech-materials-and-selection', 'Materials and selection', 'mech.materials_and_selection', 'calc_workspace', true, 5, 'calc.gen.v1', 'calc.grade.v1'),
  ('mechanical-design-engineer', 'mech-fasteners', 'Fasteners', 'mech.fasteners', 'calc_workspace', true, 6, 'calc.gen.v1', 'calc.grade.v1')
on conflict (role_key, area_key) do nothing;
