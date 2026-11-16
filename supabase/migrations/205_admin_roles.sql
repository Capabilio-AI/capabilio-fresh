-- Admin portal: roles and limits for people who can open the console, and a trail of what admins do.
--   platform_admins.role: owner (everything, manages the team), reviewer (decides, no export, no team),
--                         analyst (read only), support (looks up one person at a time).
--   platform_admins.hide_contacts: an analyst who must not see emails and phone numbers.
--   admin_audit: team changes, exports, password changes. Server-only.
-- Everyone already in platform_admins becomes an owner, so nobody loses access when this is applied.
alter table public.platform_admins add column if not exists role text not null default 'owner' check (role in ('owner', 'reviewer', 'analyst', 'support'));
alter table public.platform_admins add column if not exists hide_contacts boolean not null default false;
alter table public.platform_admins add column if not exists added_by uuid references public.profiles(id) on delete set null;
alter table public.platform_admins add column if not exists added_at timestamptz not null default now();

create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) <= 60),
  target text check (target is null or char_length(target) <= 200),
  detail text check (detail is null or char_length(detail) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_recent_idx on public.admin_audit (created_at desc);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;
