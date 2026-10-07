-- Visual roadmap: learning resources carry a type tag (Official, Article, Video, Course, ...) and a free/premium tier, and must be https links.
-- link_checked_at records when the link was last verified to load (set by `roadmap:content resources import`).
alter table public.learning_catalog
  add column resource_type text check (resource_type is null or resource_type in ('OFFICIAL', 'ARTICLE', 'VIDEO', 'COURSE', 'BOOK', 'PRACTICE')),
  add column tier text not null default 'FREE' check (tier in ('FREE', 'PREMIUM')),
  add column link_checked_at timestamptz;
alter table public.learning_catalog add constraint learning_catalog_https_url check (url is null or url ~ '^https://');
