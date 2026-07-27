-- =============================================================================
-- MASTER SCHEMA — Ayurveda Clinic SaaS
-- Run ONCE in each NEW customer's Supabase project (SQL Editor → New query → Run).
-- Turns a blank Supabase project into a working clinic database:
-- tables, keys, security rules (RLS), and the app's functions.
--
-- Built from the live Ayu:sree schema (Ayu:sree itself is NOT touched).
-- After running this, do the two SEED / FIRST-ADMIN steps at the bottom.
-- =============================================================================

-- ---- Extension (bcrypt for patient PINs; uuid generator) --------------------
create extension if not exists pgcrypto with schema extensions;

-- =============================================================================
-- TABLES
-- =============================================================================

create table if not exists public.clinics (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  op_prefix   text not null default 'AY-OP',
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  logo_url    text,
  theme_color text default '#245b35',
  review_url  text,
  tagline     text
);

create table if not exists public.staff (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  name         text not null,
  role         text not null default 'doctor' check (role in ('admin','doctor')),
  created_at   timestamptz not null default now()
);

create table if not exists public.patients (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references public.clinics(id) on delete cascade,
  op_number      text not null,
  name           text not null,
  age            integer,
  gender         text,
  mobile         text,
  address        text,
  referred_by    text,
  pin_hash       text,
  completed_days integer not null default 0,
  joined_at      date not null default current_date,
  last_visit_at  date,
  created_at     timestamptz not null default now(),
  height_cm      numeric,
  weight_kg      numeric,
  body_fat_pct   numeric,
  visceral_fat   numeric,
  bmr_kcal       numeric,
  bmi            numeric,
  water_pct      numeric,
  protein_pct    numeric,
  tests_to_do    jsonb not null default '[]'::jsonb,
  constraint patients_clinic_id_op_number_key unique (clinic_id, op_number),
  constraint patients_tests_to_do_is_array check (jsonb_typeof(tests_to_do) = 'array')
);

create table if not exists public.visits (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients(id) on delete cascade,
  issue              text,
  history            text,
  previous_treatment text,
  other_issues       jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now()
);

create table if not exists public.diagnoses (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references public.patients(id) on delete cascade,
  text                text,
  notes               text,
  shared_with_patient boolean not null default false,
  created_at          timestamptz not null default now()
);

create table if not exists public.treatments (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id) on delete cascade,
  by_doctor     text,
  name          text,
  duration_days integer not null default 30,
  start_date    date default current_date,
  instructions  text,
  advice_do     jsonb not null default '[]'::jsonb,
  advice_dont   jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists public.medicines (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id) on delete cascade,
  name         text not null,
  type         text,
  timing       text,
  dosage       text,
  food         text check (food in ('before','after')),
  instructions text,
  refill_date  date,
  created_at   timestamptz not null default now()
);

create table if not exists public.reminders (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id) on delete cascade,
  time         text,
  label        text,
  kind         text check (kind in ('kashayam','medicine','external','appointment')),
  created_at   timestamptz not null default now(),
  medicine_id  uuid references public.medicines(id) on delete cascade,
  dosage       text,
  food         text,
  instructions text
);

create table if not exists public.appointments (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id) on delete cascade,
  date          date not null,
  time          text,
  type          text not null default 'followup',
  status        text not null default 'upcoming',
  reminder_mode text default 'both',
  created_at    timestamptz not null default now()
);

create table if not exists public.mood_logs (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  mood       text not null check (mood in ('love','happy','sad')),
  logged_on  date not null default current_date,
  seen       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mood_logs_patient_id_logged_on_key unique (patient_id, logged_on)
);

create table if not exists public.offers (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  image_url  text,
  title      text,
  body       text,
  badge      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lists (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  kind       text not null check (kind in ('doctor','treatment','medicine','advice_do','advice_dont')),
  label      text not null,
  created_at timestamptz not null default now(),
  constraint lists_clinic_id_kind_label_key unique (clinic_id, kind, label)
);

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- FUNCTIONS  (verbatim from the live schema)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_clinic_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select clinic_id from staff where auth_user_id = auth.uid() limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.clinic_branding(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('name',name,'op_prefix',op_prefix,'logo_url',logo_url,
    'theme_color',theme_color,'review_url',review_url,'tagline',tagline)
  from clinics where slug = p_slug limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.patient_portal(p_op text, p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare pat patients; result jsonb;
begin
  select * into pat from patients
   where upper(btrim(op_number)) = upper(btrim(p_op))
     and pin_hash is not null and pin_hash = crypt(btrim(p_pin), pin_hash)
   limit 1;
  if not found then return jsonb_build_object('error','invalid'); end if;
  select jsonb_build_object(
    'patient', to_jsonb(pat) - 'pin_hash',
    'visit', (select to_jsonb(v) from visits v where v.patient_id = pat.id order by v.created_at desc limit 1),
    'treatment', (select to_jsonb(t) from treatments t where t.patient_id = pat.id order by t.created_at desc limit 1),
    'medicines', (select coalesce(jsonb_agg(m),'[]'::jsonb) from medicines m where m.patient_id = pat.id),
    'reminders', (select coalesce(jsonb_agg(r),'[]'::jsonb) from reminders r where r.patient_id = pat.id),
    'appointments', (select coalesce(jsonb_agg(a),'[]'::jsonb) from appointments a where a.patient_id = pat.id),
    'offers', (select coalesce(jsonb_agg(o),'[]'::jsonb) from offers o where o.clinic_id = pat.clinic_id and o.active),
    'diagnosis', (select case when d.shared_with_patient then jsonb_build_object('text',d.text,'notes',d.notes) else null end
                  from diagnoses d where d.patient_id = pat.id order by d.created_at desc limit 1),
    'mood_today', (select mood from mood_logs ml where ml.patient_id = pat.id and ml.logged_on = current_date limit 1)
  ) into result;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_mood(p_op text, p_pin text, p_mood text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare pat patients;
begin
  if p_mood not in ('love','happy','sad') then
    return jsonb_build_object('error','invalid_mood');
  end if;
  select * into pat from patients
   where upper(btrim(op_number)) = upper(btrim(p_op))
     and pin_hash is not null and pin_hash = crypt(btrim(p_pin), pin_hash)
   limit 1;
  if not found then return jsonb_build_object('error','invalid'); end if;

  insert into mood_logs (patient_id, clinic_id, mood, logged_on, seen, updated_at)
  values (pat.id, pat.clinic_id, p_mood, current_date, false, now())
  on conflict (patient_id, logged_on)
  do update set mood = excluded.mood, seen = false, updated_at = now();

  return jsonb_build_object('ok', true, 'mood', p_mood);
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_patient_pin(p_patient_id uuid, p_pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if current_clinic_id() is null then raise exception 'not authorised'; end if;
  update patients set pin_hash = crypt(p_pin, gen_salt('bf'))
   where id = p_patient_id and clinic_id = current_clinic_id();
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_push_subscription(p_op text, p_pin text, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  pat_id uuid;
  subscription_id uuid;
begin
  if nullif(btrim(p_endpoint), '') is null
    or nullif(btrim(p_p256dh), '') is null
    or nullif(btrim(p_auth), '') is null then
    raise exception 'invalid push subscription' using errcode = '22023';
  end if;

  select id into pat_id
  from public.patients
  where upper(btrim(op_number)) = upper(btrim(p_op))
    and pin_hash is not null
    and pin_hash = crypt(btrim(p_pin), pin_hash)
  limit 1;

  if pat_id is null then
    raise exception 'invalid patient credentials' using errcode = '28000';
  end if;

  insert into public.push_subscriptions (
    patient_id, endpoint, p256dh, auth, user_agent, active
  ) values (
    pat_id, p_endpoint, p_p256dh, p_auth, p_user_agent, true
  )
  on conflict (endpoint) do update set
    patient_id = excluded.patient_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    active = true,
    updated_at = now()
  returning id into subscription_id;

  return subscription_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.disable_push_subscription(p_op text, p_pin text, p_endpoint text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  pat_id uuid;
  changed boolean;
begin
  select id into pat_id
  from public.patients
  where upper(btrim(op_number)) = upper(btrim(p_op))
    and pin_hash is not null
    and pin_hash = crypt(btrim(p_pin), pin_hash)
  limit 1;

  if pat_id is null then
    raise exception 'invalid patient credentials' using errcode = '28000';
  end if;

  update public.push_subscriptions
  set active = false, updated_at = now()
  where patient_id = pat_id and endpoint = p_endpoint;

  changed := found;
  return changed;
end;
$function$;

-- =============================================================================
-- ROW-LEVEL SECURITY  (enable + policies)
-- Staff (authenticated) see only their own clinic; patients reach data only
-- through the SECURITY DEFINER functions above.
-- =============================================================================

alter table public.clinics            enable row level security;
alter table public.staff              enable row level security;
alter table public.patients           enable row level security;
alter table public.visits             enable row level security;
alter table public.diagnoses          enable row level security;
alter table public.treatments         enable row level security;
alter table public.medicines          enable row level security;
alter table public.reminders          enable row level security;
alter table public.appointments       enable row level security;
alter table public.mood_logs          enable row level security;
alter table public.offers             enable row level security;
alter table public.lists              enable row level security;
alter table public.push_subscriptions enable row level security;  -- no policy: RPC-only access

create policy clinic_read   on public.clinics for select to authenticated using (id = current_clinic_id());
create policy clinic_update on public.clinics for update to authenticated using (id = current_clinic_id()) with check (id = current_clinic_id());

create policy staff_self on public.staff for select to authenticated using (auth_user_id = auth.uid());

create policy p_all on public.patients for all to authenticated
  using (clinic_id = current_clinic_id()) with check (clinic_id = current_clinic_id());

create policy v_all on public.visits for all to authenticated
  using (exists (select 1 from patients p where p.id = visits.patient_id and p.clinic_id = current_clinic_id()))
  with check (exists (select 1 from patients p where p.id = visits.patient_id and p.clinic_id = current_clinic_id()));

create policy dx_all on public.diagnoses for all to authenticated
  using (exists (select 1 from patients p where p.id = diagnoses.patient_id and p.clinic_id = current_clinic_id()))
  with check (exists (select 1 from patients p where p.id = diagnoses.patient_id and p.clinic_id = current_clinic_id()));

create policy tr_all on public.treatments for all to authenticated
  using (exists (select 1 from patients p where p.id = treatments.patient_id and p.clinic_id = current_clinic_id()))
  with check (exists (select 1 from patients p where p.id = treatments.patient_id and p.clinic_id = current_clinic_id()));

create policy md_all on public.medicines for all to authenticated
  using (exists (select 1 from patients p where p.id = medicines.patient_id and p.clinic_id = current_clinic_id()))
  with check (exists (select 1 from patients p where p.id = medicines.patient_id and p.clinic_id = current_clinic_id()));

create policy rm_all on public.reminders for all to authenticated
  using (exists (select 1 from patients p where p.id = reminders.patient_id and p.clinic_id = current_clinic_id()))
  with check (exists (select 1 from patients p where p.id = reminders.patient_id and p.clinic_id = current_clinic_id()));

create policy ap_all on public.appointments for all to authenticated
  using (exists (select 1 from patients p where p.id = appointments.patient_id and p.clinic_id = current_clinic_id()))
  with check (exists (select 1 from patients p where p.id = appointments.patient_id and p.clinic_id = current_clinic_id()));

create policy mood_staff on public.mood_logs for all to authenticated
  using (clinic_id = current_clinic_id()) with check (clinic_id = current_clinic_id());

create policy of_staff on public.offers for all to authenticated
  using (clinic_id = current_clinic_id()) with check (clinic_id = current_clinic_id());

create policy lists_all on public.lists for all to authenticated
  using (clinic_id = current_clinic_id()) with check (clinic_id = current_clinic_id());

-- =============================================================================
-- GRANTS
-- Staff (authenticated) get table access, gated by the RLS policies above.
-- The anon (public) key can ONLY call the patient-facing RPCs.
-- =============================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

grant execute on function public.patient_portal(text, text)                                   to anon, authenticated;
grant execute on function public.submit_mood(text, text, text)                                 to anon, authenticated;
grant execute on function public.clinic_branding(text)                                         to anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text, text, text, text)    to anon, authenticated;
grant execute on function public.disable_push_subscription(text, text, text)                   to anon, authenticated;
grant execute on function public.set_patient_pin(uuid, text)                                   to authenticated;
grant execute on function public.current_clinic_id()                                           to authenticated;

-- =============================================================================
-- SEED  ▸ EDIT the 3 values, then run this block.
-- Creates the clinic row (its slug MUST equal CLINIC.id in config/clinic.config.js)
-- and default dropdown lists so the admin isn't empty.
-- =============================================================================

with c as (
  insert into public.clinics (slug, name, op_prefix, theme_color)
  values ('REPLACE-slug', 'REPLACE Clinic Name', 'OP', '#245b35')   -- ◀ EDIT
  returning id
)
insert into public.lists (clinic_id, kind, label)
select c.id, v.kind, v.label from c, (values
  ('doctor',      'Doctor 1'),
  ('treatment',   'Abhyangam (Oil Massage)'),
  ('treatment',   'Kizhi (Herbal Bolus)'),
  ('treatment',   'Panchakarma Detox'),
  ('treatment',   'Nasyam'),
  ('treatment',   'Shirodhara'),
  ('medicine',    'Kashayam'),
  ('medicine',    'Gulika (Tablet)'),
  ('medicine',    'Choornam (Powder)'),
  ('medicine',    'Lehyam'),
  ('medicine',    'Arishtam'),
  ('medicine',    'Thailam (Oil)'),
  ('advice_do',   'Light walking daily'),
  ('advice_do',   'Drink warm water'),
  ('advice_dont', 'Avoid cold exposure'),
  ('advice_dont', 'Avoid long sitting')
) as v(kind, label);

-- =============================================================================
-- FIRST ADMIN LOGIN (bootstrap — no Edge Function needed)
--   1. Supabase Dashboard → Authentication → Users → "Add user" (email + password).
--   2. Copy that user's UUID, then run (replace the UUID and the slug):
--
-- insert into public.staff (auth_user_id, clinic_id, name, role)
-- select '<PASTE_AUTH_USER_UUID>', id, 'Clinic Admin', 'admin'
-- from public.clinics where slug = 'REPLACE-slug';
--
--   That staff member can now log in at the clinic's /admin/ console and add
--   more staff (the "Add staff" button uses the optional manage-staff Edge
--   Function — deploy it later if you want in-app staff creation).
-- =============================================================================
