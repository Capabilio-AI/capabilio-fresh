-- Portfolio contact details a recruiter can use. Both are the student's own: the phone is optional, and neither the email nor the phone
-- appears on the public portfolio unless the student switches portfolio_show_contact on (off by default).
alter table public.profiles
  add column if not exists phone text check (phone is null or phone ~ '^[+0-9 ()-]{7,20}$'),
  add column if not exists portfolio_show_contact boolean not null default false;

grant update (phone, portfolio_show_contact) on public.profiles to authenticated;
