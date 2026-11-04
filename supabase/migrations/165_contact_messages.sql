-- Questions sent from the public landing "Contact us" form. No login; written only through the server (service role).
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  topic text not null check (topic in ('student', 'college', 'company', 'other')),
  message text not null check (char_length(message) between 10 and 2000),
  created_at timestamptz not null default now()
);
create index contact_messages_created_idx on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
