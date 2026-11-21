-- Great Job: core schema, row level security, quota function, resume storage.

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  resume jsonb,
  resume_path text,
  profile_version int not null default 1,
  onboarded_at timestamptz
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ats text not null check (ats in ('greenhouse', 'lever', 'ashby')),
  board_token text not null,
  unique (ats, board_token)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade,
  source text not null,
  external_id text not null,
  url text,
  company_id uuid references public.companies on delete set null,
  company_name text,
  title text not null,
  location text,
  remote bool,
  salary_text text,
  skills text[] not null default '{}',
  description text,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  fingerprint text,
  vague_description bool not null default false,
  evergreen bool not null default false,
  unique (source, external_id)
);

create table public.job_sightings (
  fingerprint text not null,
  source_domain text not null,
  seen_on date not null,
  primary key (fingerprint, source_domain, seen_on)
);

create table public.evaluations (
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid not null references public.jobs on delete cascade,
  score int,
  matches jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  ghost_level text,
  ghost_signals jsonb not null default '[]'::jsonb,
  profile_version int,
  error text,
  primary key (user_id, job_id)
);

create table public.applications (
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid not null references public.jobs on delete cascade,
  status text not null default 'found',
  note text,
  status_changed_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  kind text not null,
  count int not null default 0,
  primary key (user_id, day, kind)
);

-- Row level security
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.job_sightings enable row level security; -- no policy: service role only
alter table public.evaluations enable row level security;
alter table public.applications enable row level security;
alter table public.ai_usage enable row level security;

create policy profiles_owner on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy evaluations_owner on public.evaluations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy applications_owner on public.applications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy companies_read on public.companies for select to authenticated using (true);
create policy companies_insert on public.companies for insert to authenticated with check (true);

create policy jobs_read on public.jobs for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy jobs_insert on public.jobs for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy jobs_update on public.jobs for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy ai_usage_read on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Create a profile row for every new user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomically count one use for today; true while within the limit.
create function public.consume_quota(p_kind text, p_limit int) returns boolean
language sql security definer set search_path = '' as $$
  insert into public.ai_usage (user_id, day, kind, count)
  values (auth.uid(), current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = public.ai_usage.count + 1
  returning count <= p_limit;
$$;
revoke execute on function public.consume_quota(text, int) from public, anon;
grant execute on function public.consume_quota(text, int) to authenticated;

-- Private resume bucket; files live under <user id>/
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy resumes_own_folder on storage.objects for all to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
