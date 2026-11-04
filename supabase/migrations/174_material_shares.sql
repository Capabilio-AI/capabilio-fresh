-- One thing shared with students is ONE material, however many branch-and-year groups it goes to. Each group still has its own row (that is how
-- students are matched), and share_id ties the rows of one share together so the library shows one item and a student sees one copy.
alter table public.class_materials add column if not exists share_id uuid;

-- Rows made before this from one upload to several groups share a file and an author: they are one share.
with g as materialized (
  select author_membership_id, file_path, gen_random_uuid() as sid
  from public.class_materials where file_path is not null group by author_membership_id, file_path
)
update public.class_materials m set share_id = g.sid
from g where m.file_path is not null and m.author_membership_id = g.author_membership_id and m.file_path = g.file_path and m.share_id is null;

update public.class_materials set share_id = id where share_id is null;
alter table public.class_materials alter column share_id set default gen_random_uuid();
alter table public.class_materials alter column share_id set not null;
create index if not exists class_materials_share_idx on public.class_materials (share_id);
