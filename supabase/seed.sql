-- Generated from supabase/companies.seed.csv (the source of truth); regenerate when the CSV changes.
insert into public.companies (name, ats, board_token) values
  ('Stripe', 'greenhouse', 'stripe'),
  ('Airbnb', 'greenhouse', 'airbnb'),
  ('Discord', 'greenhouse', 'discord'),
  ('Cloudflare', 'greenhouse', 'cloudflare'),
  ('Datadog', 'greenhouse', 'datadog'),
  ('Figma', 'greenhouse', 'figma'),
  ('GitLab', 'greenhouse', 'gitlab'),
  ('Coinbase', 'greenhouse', 'coinbase'),
  ('Databricks', 'greenhouse', 'databricks'),
  ('Pinterest', 'greenhouse', 'pinterest'),
  ('Twilio', 'greenhouse', 'twilio'),
  ('Okta', 'greenhouse', 'okta'),
  ('Asana', 'greenhouse', 'asana'),
  ('Dropbox', 'greenhouse', 'dropbox'),
  ('Reddit', 'greenhouse', 'reddit'),
  ('Vercel', 'greenhouse', 'vercel'),
  ('MongoDB', 'greenhouse', 'mongodb'),
  ('Elastic', 'greenhouse', 'elastic'),
  ('Spotify', 'lever', 'spotify'),
  ('Palantir', 'lever', 'palantir'),
  ('Notion', 'ashby', 'notion'),
  ('Ramp', 'ashby', 'ramp'),
  ('Linear', 'ashby', 'linear'),
  ('OpenAI', 'ashby', 'openai'),
  ('Supabase', 'ashby', 'supabase')
on conflict (ats, board_token) do nothing;

-- Local e2e users (supabase db reset only; never runs on a hosted project). Password: e2e-password
-- e2e-new is not onboarded; e2e-onboarded already has prefs and a resume profile.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'e2e-new@example.test', crypt('e2e-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'e2e-onboarded@example.test', crypt('e2e-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict do nothing;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u where u.email like 'e2e-%@example.test'
on conflict do nothing;

update public.profiles set
  prefs = '{"roles":["Backend"],"modes":["remote"],"minSalaryThb":null,"seniority":"mid"}'::jsonb,
  resume = '{"skills":["Java","PostgreSQL","APIs"],"experience":[{"title":"Backend Developer","company":"Example Co","start":"2020-01","end":null,"summary":"Built payment APIs in Java."}],"education":[{"school":"Example University","degree":"BSc Computer Science"}],"yearsTotal":5}'::jsonb,
  onboarded_at = now()
where user_id = '22222222-2222-4222-8222-222222222222';
