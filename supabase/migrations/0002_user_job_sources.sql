-- Signed-in users may only write their own private rows from user sources.
-- Shared rows (owner_id null; greenhouse, lever, ashby, remoteok) are written with the service role only.
drop policy jobs_insert on public.jobs;
drop policy jobs_update on public.jobs;

create policy jobs_insert on public.jobs for insert to authenticated
  with check (owner_id = (select auth.uid()) and source in ('paste', 'extension'));
create policy jobs_update on public.jobs for update to authenticated
  using (owner_id = (select auth.uid()) and source in ('paste', 'extension'))
  with check (owner_id = (select auth.uid()) and source in ('paste', 'extension'));
