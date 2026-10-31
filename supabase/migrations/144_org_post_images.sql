-- A post can carry more than one picture (every page of an uploaded circular), shown whole, in order. cover_image_url stays the first one.
alter table public.org_posts add column if not exists image_urls text[] not null default '{}';
