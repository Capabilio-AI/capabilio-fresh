-- IOT-01 IoT Firmware Engineer role (Wave 2, logic tier). It reuses two existing workstations with its own area keys and templates
-- (lib/workplace/iot, lib/workplace/calc/iot.ts): payloads, device logic, protocol handling and OTA/version rules on the code workstation (the learner's
-- function runs in their browser on scripted inputs and the server compares the outputs; no broker, device, radio or cloud), and power/link/data-cost
-- arithmetic on the calc workstation. Real MQTT broker, provisioning, OTA on hardware and security hardening are not assessed.
insert into public.careers (key, name, category, description) values
  ('iot-firmware-engineer', 'IoT Firmware Engineer', 'Engineering', 'Writes the logic that connected devices run: telemetry payloads, buffering and retries, MQTT and Modbus handling, firmware versions and rollout, and power and link budgets.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('iot-firmware-engineer', 'IoT Firmware Engineer', 'IoT Firmware', array['iot firmware engineer', 'iot engineer', 'iot developer', 'iot firmware', 'embedded iot engineer', 'connected device engineer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('iot-firmware-engineer', 'iot-telemetry-payloads', 'Telemetry payloads', 'iot.telemetry_payloads', 'code_workspace', true, 1, 'code.gen.v1', 'code.grade.v1'),
  ('iot-firmware-engineer', 'iot-device-logic', 'Device logic', 'iot.device_logic', 'code_workspace', true, 2, 'code.gen.v1', 'code.grade.v1'),
  ('iot-firmware-engineer', 'iot-protocol-handling', 'Protocol handling', 'iot.protocol_handling', 'code_workspace', true, 3, 'code.gen.v1', 'code.grade.v1'),
  ('iot-firmware-engineer', 'iot-ota-and-versions', 'OTA and versions', 'iot.ota_and_versions', 'code_workspace', true, 4, 'code.gen.v1', 'code.grade.v1'),
  ('iot-firmware-engineer', 'iot-power-and-link-calcs', 'Power and link calculations', 'iot.power_and_link_calcs', 'calc_workspace', true, 5, 'calc.gen.v1', 'calc.grade.v1')
on conflict (role_key, area_key) do nothing;
