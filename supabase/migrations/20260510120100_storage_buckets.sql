-- =============================================================================
-- 20260510120100_storage_buckets.sql
-- Private buckets for evidence and rendered dossier PDFs. Access is mediated
-- by signed URLs issued from the server after the case-ownership check.
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('evidence', 'evidence', false),
  ('dossiers', 'dossiers', false)
on conflict (id) do nothing;

-- Owner-scoped read/write on the buckets. The first path segment is the
-- case_id, e.g. evidence/<case_id>/photo.jpg. We accept the upload only if the
-- case belongs to the caller.
create policy "evidence read by case owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and public.case_belongs_to_me((storage.foldername(name))[1]::uuid)
  );

create policy "evidence write by case owner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and public.case_belongs_to_me((storage.foldername(name))[1]::uuid)
  );

create policy "evidence update by case owner"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'evidence'
    and public.case_belongs_to_me((storage.foldername(name))[1]::uuid)
  );

create policy "dossiers read by case owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'dossiers'
    and public.case_belongs_to_me((storage.foldername(name))[1]::uuid)
  );

create policy "dossiers write by case owner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dossiers'
    and public.case_belongs_to_me((storage.foldername(name))[1]::uuid)
  );
