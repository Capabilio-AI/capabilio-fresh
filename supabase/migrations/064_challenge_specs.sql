-- Role-aware Arena Challenges, Phase 5: authored challenges are kept as a spec (JSON) so they can be edited, re-validated and re-imported
-- without a deploy. The spec holds hidden answers, so none of these columns is granted to students (arena_challenges is column-granted).
alter table public.arena_challenges
  add column spec_key text unique check (spec_key is null or spec_key ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  add column spec jsonb,
  /** sha256 of the spec as last validated; publishing requires it to equal the current spec's hash */
  add column validated_hash text,
  add column validated_at timestamptz;
