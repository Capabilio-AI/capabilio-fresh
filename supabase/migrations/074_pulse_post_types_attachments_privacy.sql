-- Pulse: structured post types, PDF attachments, and privacy for the career goal shown on a profile. Additive.
-- meta holds the type-specific fields (project stack and links, question tags, achievement issuer and proof); validated in code.
alter table public.posts
  add column meta jsonb check (meta is null or jsonb_typeof(meta) = 'object'),
  add column attachment_path text check (char_length(attachment_path) <= 300),
  add column attachment_name text check (char_length(attachment_name) <= 200),
  add column attachment_size integer check (attachment_size >= 0),
  add column tags text[] not null default '{}';
create index posts_tags_idx on public.posts using gin (tags);
-- Existing posts: lift their #hashtags into the new column so tag pages and trending see them.
update public.posts p
   set tags = coalesce((select array_agg(distinct lower(m[1])) from regexp_matches(p.content, '(?:^|\s)#([A-Za-z][A-Za-z0-9_]{1,29})', 'g') as m), '{}')
 where p.content ~ '#[A-Za-z]';

alter table public.community_posts
  add column meta jsonb check (meta is null or jsonb_typeof(meta) = 'object'),
  add column attachment_path text check (char_length(attachment_path) <= 300),
  add column attachment_name text check (char_length(attachment_name) <= 200),
  add column attachment_size integer check (attachment_size >= 0),
  add column tags text[] not null default '{}';
-- A question or achievement can be all title with no body text.
alter table public.community_posts drop constraint community_posts_content_check;
alter table public.community_posts add constraint community_posts_content_check check (char_length(content) <= 3000);

-- Whether the person's career goal ("Aspiring AI/ML Engineer") appears under their name on Pulse.
alter table public.profiles add column pulse_show_career boolean not null default true;

-- Documents (PDF) up to 10 MB beside the images; the image limit of 5 MB is enforced in code.
update storage.buckets
   set file_size_limit = 10485760, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
 where id = 'pulse-media';
