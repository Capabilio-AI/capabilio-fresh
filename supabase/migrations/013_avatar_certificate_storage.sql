-- STATUS: APPLIED to production 2026-09-28.
-- Adds Supabase Storage support for profile pictures and certificate
-- uploads (neither existed before this migration — no storage buckets
-- were configured in this project at all).
--
-- vault_items.verified distinguishes a file-backed upload that passed
-- real integrity checks (correct type, size, not corrupt) from a
-- self-reported item added via the plain "Add item" form in Vault — it is
-- NOT a claim of document authenticity, only that a real file was
-- received and validated. Defaults to false so existing self-reported
-- rows are not silently reclassified as verified.

alter table public.vault_items
  add column verified boolean not null default false,
  add column file_path text;

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- avatars: public read, owner-only write, path convention <user_id>/<filename>
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars owner write"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- certificates: private, owner-only read/write, same path convention
create policy "certificates owner read"
  on storage.objects for select
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "certificates owner write"
  on storage.objects for insert
  with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "certificates owner delete"
  on storage.objects for delete
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);
