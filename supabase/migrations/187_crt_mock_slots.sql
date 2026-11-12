-- A placement cell can schedule a MOCK assessment in the same windows as a CRT cycle: students see it locked until the slot opens, can start it only
-- while it is open, and take it once. kind separates the two so a mock never counts as the college's official assessment (readiness, six-monthly rhythm).
alter table public.crt_cycles
  add column if not exists kind text not null default 'assessment' check (kind in ('assessment', 'mock')),
  add column if not exists mock_key text;
alter table public.crt_cycles drop constraint if exists crt_cycles_mock_key_check;
alter table public.crt_cycles add constraint crt_cycles_mock_key_check check ((kind = 'mock') = (mock_key is not null));
