-- SOC Analyst role (IT-11, Cybersecurity). The learner works an L1 shift in the SOC Console (soc_workspace): an alert queue and a few hundred synthetic
-- log lines generated from a seed. They search the logs in their browser and submit a decision per alert; the server grades it against the key derived
-- from the same seed (lib/workplace/soc). Fictional companies, documentation-only IP ranges, reserved domains; educational only.
insert into public.careers (key, name, category, description) values
  ('soc-analyst', 'SOC Analyst', 'Cybersecurity', 'Monitors security alerts: triages the queue, investigates logs, maps attacks to MITRE ATT&CK and starts the incident response.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('soc-analyst', 'SOC Analyst', 'Security Operations', array['soc analyst', 'soc l1', 'security operations', 'security analyst', 'cyber security analyst', 'cybersecurity analyst', 'siem analyst', 'blue team', 'incident responder', 'l1 security', 'threat monitoring'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('soc-analyst', 'alert-triage', 'Alert triage', 'soc.alert_triage', 'soc_workspace', true, 1, 'soc.gen.v1', 'soc.grade.v1'),
  ('soc-analyst', 'log-investigation', 'Log investigation', 'soc.log_investigation', 'soc_workspace', true, 2, 'soc.gen.v1', 'soc.grade.v1'),
  ('soc-analyst', 'threat-mapping', 'Threat mapping (MITRE ATT&CK)', 'soc.threat_mapping', 'soc_workspace', true, 3, 'soc.gen.v1', 'soc.grade.v1'),
  ('soc-analyst', 'incident-response', 'Incident response', 'soc.incident_response', 'soc_workspace', true, 4, 'soc.gen.v1', 'soc.grade.v1'),
  ('soc-analyst', 'phishing-analysis', 'Phishing analysis', 'soc.phishing_analysis', 'soc_workspace', true, 5, 'soc.gen.v1', 'soc.grade.v1')
on conflict (role_key, area_key) do nothing;
