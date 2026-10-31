-- Readiness is now proof-capped (screening answers count up to 40 per skill; only Arena / verified work raises it).
-- Re-publishing every student's graph under the new rule is its own kind of snapshot, so history never claims it was an Arena event.
alter table public.career_skill_graph_snapshots drop constraint if exists career_skill_graph_snapshots_trigger_check;
alter table public.career_skill_graph_snapshots add constraint career_skill_graph_snapshots_trigger_check
  check (trigger in ('ASSESSMENT','ARENA','PROOF_OF_WORK','RECALIBRATION'));
