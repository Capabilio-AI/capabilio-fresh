-- Non-IT branches (Mech, Civil, ECE, EEE, MBA, ...) get calculation
-- challenges answered with a number + unit, not a code editor. The
-- expected value is produced by executing a hidden AI-written reference
-- solution server-side, never by trusting the model's own arithmetic.
alter table public.arena_challenges
  add column kind text not null default 'code' check (kind in ('code', 'numeric')),
  add column answer_unit text;

-- Existing non-IT stream rows were generated as coding tasks, and domain
-- was removed; deactivate (not delete) so the pools regenerate correctly.
update public.arena_challenges
set active = false
where track = 'domain'
   or (track = 'stream' and scope_key <> 'it-cluster' and kind = 'code');
