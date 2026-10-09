-- one snapshot per assessment session (NULL session_id, i.e. Arena snapshots, stays unrestricted): a retried submit cannot duplicate history
alter table public.career_skill_graph_snapshots add constraint career_skill_graph_snapshots_session_key unique (session_id);
