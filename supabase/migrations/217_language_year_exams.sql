-- A language's year exams are recorded in learning_tier_proof under the area 'lang-<track>' (lang-c, lang-python, ...), next to the Basic Programming proof.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.learning_tier_proof'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%area%' loop
    execute format('alter table public.learning_tier_proof drop constraint %I', c);
  end loop;
end $$;
alter table public.learning_tier_proof add constraint learning_tier_proof_area_check
  check (area in ('basic-programming', 'it', 'stream') or area ~ '^lang-[a-z]+$');
