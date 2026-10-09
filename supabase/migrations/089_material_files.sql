-- Staff can share an uploaded file (PDF, Word, PowerPoint, Excel, image) as a course material, not only a link.
-- Additive: existing notes, PDF links and links stay valid.
alter table public.class_materials
  add column if not exists file_path text check (file_path is null or char_length(file_path) <= 300),
  add column if not exists file_name text check (file_name is null or char_length(file_name) <= 200),
  add column if not exists file_size integer check (file_size is null or file_size > 0),
  add column if not exists file_mime text check (file_mime is null or char_length(file_mime) <= 120);

alter table public.class_materials drop constraint if exists class_materials_type_check;
alter table public.class_materials add constraint class_materials_type_check check (type in ('notes', 'pdf', 'link', 'file'));

alter table public.class_materials drop constraint if exists class_materials_check;
alter table public.class_materials add constraint class_materials_check check (
  (type = 'notes' and body is not null)
  or (type = 'file' and file_path is not null and file_name is not null)
  or (type in ('pdf', 'link') and url is not null)
);
