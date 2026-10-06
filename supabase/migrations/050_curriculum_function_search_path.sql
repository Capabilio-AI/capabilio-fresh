-- Pin search_path on the 048/049 functions (Supabase advisor 0011). They already schema-qualify every reference.
alter function public.curriculum_import_is_frozen(uuid) set search_path = public, pg_temp;
alter function public.guard_frozen_by_import() set search_path = public, pg_temp;
alter function public.guard_frozen_by_course() set search_path = public, pg_temp;
alter function public.guard_import_lifecycle() set search_path = public, pg_temp;
alter function public.guard_version_immutable() set search_path = public, pg_temp;
alter function public.publish_curriculum_import(uuid, uuid) set search_path = public, pg_temp;
