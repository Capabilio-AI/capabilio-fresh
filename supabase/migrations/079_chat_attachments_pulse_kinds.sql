-- Chat attachments (photos, PDFs, Office files) in Pulse messages and staff team chat, plus two post kinds that
-- make Pulse a place to network: "opportunity" (jobs, internships, referrals) and "resource" (a useful link).
-- Additive: new nullable columns, relaxed text checks (a message may be only an attachment), a wider kind check.

alter table public.dm_messages
  add column if not exists attachment_path text check (char_length(attachment_path) <= 300),
  add column if not exists attachment_name text check (char_length(attachment_name) <= 200),
  add column if not exists attachment_size integer check (attachment_size >= 0),
  add column if not exists attachment_mime text check (char_length(attachment_mime) <= 120);
alter table public.dm_messages drop constraint if exists dm_messages_body_check;
-- the original table-level check (auto-named dm_messages_check) also demanded text, so it goes too
alter table public.dm_messages drop constraint if exists dm_messages_check;
alter table public.dm_messages add constraint dm_messages_body_check
  check (deleted_at is not null or attachment_path is not null or char_length(btrim(body)) between 1 and 2000);

alter table public.org_chat_messages
  add column if not exists attachment_path text check (char_length(attachment_path) <= 300),
  add column if not exists attachment_name text check (char_length(attachment_name) <= 200),
  add column if not exists attachment_size integer check (attachment_size >= 0),
  add column if not exists attachment_mime text check (char_length(attachment_mime) <= 120);
alter table public.org_chat_messages drop constraint if exists org_chat_messages_body_check;
alter table public.org_chat_messages add constraint org_chat_messages_body_check
  check (attachment_path is not null or char_length(btrim(body)) between 1 and 2000);

alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check check (kind in ('post', 'project', 'question', 'achievement', 'opportunity', 'resource'));
alter table public.community_posts drop constraint if exists community_posts_kind_check;
alter table public.community_posts add constraint community_posts_kind_check check (kind in ('post', 'project', 'question', 'achievement', 'opportunity', 'resource'));

-- Word, Excel and PowerPoint files beside images and PDFs (still 10 MB; types are also checked from the file's bytes in code).
update storage.buckets
   set allowed_mime_types = array[
     'image/png', 'image/jpeg', 'image/webp', 'application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation'
   ]
 where id = 'pulse-media';
