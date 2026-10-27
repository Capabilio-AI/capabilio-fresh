-- ECE-01 Embedded Systems Engineer role (wave 2). Firmware LOGIC is simulated: the learner's function runs in their browser (code workstation, client-run)
-- against scripted virtual inputs (buttons, sensors, ticks) and the server compares the returned pin/serial traces. It is not a real MCU, IDE or
-- debugger. Circuit calculations use the calc workstation. Templates live in lib/workplace/embedded and lib/workplace/calc/embedded.ts.
-- No careers row: 'Embedded Systems Engineer' already exists as career 'ai-embedded-systems-engineer' (careers.name is unique), so inserting one would abort.

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('embedded-systems-engineer', 'Embedded Systems Engineer', 'Embedded Systems', array['embedded systems engineer', 'embedded engineer', 'embedded software engineer', 'embedded developer', 'firmware engineer', 'firmware developer', 'embedded firmware engineer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('embedded-systems-engineer', 'emb-gpio-state-machines', 'GPIO and state machines', 'emb.gpio_state_machines', 'code_workspace', true, 1, 'code.gen.v1', 'code.grade.v1'),
  ('embedded-systems-engineer', 'emb-sensors-and-thresholds', 'Sensors and thresholds', 'emb.sensors_and_thresholds', 'code_workspace', true, 2, 'code.gen.v1', 'code.grade.v1'),
  ('embedded-systems-engineer', 'emb-serial-protocols', 'Serial protocols', 'emb.serial_protocols', 'code_workspace', true, 3, 'code.gen.v1', 'code.grade.v1'),
  ('embedded-systems-engineer', 'emb-timing', 'Timing and PWM', 'emb.timing', 'code_workspace', true, 4, 'code.gen.v1', 'code.grade.v1'),
  ('embedded-systems-engineer', 'emb-circuit-calcs', 'Circuit calculations', 'emb.circuit_calcs', 'calc_workspace', true, 5, 'calc.gen.v1', 'calc.grade.v1')
on conflict (role_key, area_key) do nothing;
