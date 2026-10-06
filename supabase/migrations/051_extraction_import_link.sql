-- Phase 3: a staged extraction points at the curriculum_imports row it produced (status EXTRACTED, invisible to students).
-- Discarding the staged extraction soft-deletes that import while it is still unpublished.
alter table public.curriculum_extractions
  add column import_id uuid references public.curriculum_imports(id) on delete set null;
