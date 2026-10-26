-- EEE-03 Industrial Automation / PLC Engineer: an EEE fresher's first job on a control panel. The PLC logic is SIMULATED: the learner writes one pure scan-cycle
-- function (inputs, state) -> (outputs, state) in their browser on the code workstation and the server compares output traces; the electrical calculations run
-- on the calc workstation. It is not TIA Portal/CODESYS or a ladder editor; ladder diagrams, HMI, real I/O and safety certification are not assessed.
-- Templates live in lib/workplace/plc.
insert into public.careers (key, name, category, description) values
  ('plc-automation-engineer', 'PLC Automation Engineer', 'Engineering', 'Programs and checks the control logic of machines and process plant: interlocks, timers, sequences, fault handling and the electrical numbers behind a panel.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('plc-automation-engineer', 'PLC Automation Engineer', 'Industrial Automation', array['plc engineer', 'plc programmer', 'plc developer', 'plc automation engineer', 'industrial automation engineer', 'industrial automation', 'control panel engineer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('plc-automation-engineer', 'plc-boolean-logic', 'Boolean logic and interlocks', 'plc.boolean_logic', 'code_workspace', true, 1, 'code.gen.v1', 'code.grade.v1'),
  ('plc-automation-engineer', 'plc-timers-counters', 'Timers and counters', 'plc.timers_counters', 'code_workspace', true, 2, 'code.gen.v1', 'code.grade.v1'),
  ('plc-automation-engineer', 'plc-process-sequences', 'Process sequences', 'plc.process_sequences', 'code_workspace', true, 3, 'code.gen.v1', 'code.grade.v1'),
  ('plc-automation-engineer', 'plc-fault-handling', 'Fault handling', 'plc.fault_handling', 'code_workspace', true, 4, 'code.gen.v1', 'code.grade.v1'),
  ('plc-automation-engineer', 'plc-electrical-calcs', 'Electrical calculations', 'plc.electrical_calcs', 'calc_workspace', true, 5, 'calc.gen.v1', 'calc.grade.v1')
on conflict (role_key, area_key) do nothing;
