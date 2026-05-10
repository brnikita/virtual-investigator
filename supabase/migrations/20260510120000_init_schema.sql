-- =============================================================================
-- 20260510120000_init_schema.sql
-- Core domain tables for Virtual Investigator.
--
-- Naming: singular row-level concepts named in the plural (cases, interviews).
-- Every user-owned table carries `owner_id` referencing auth.users(id) and is
-- protected by Row Level Security so that one player can never see another
-- player's cases.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- profiles: lightweight per-user metadata (display name, language pref).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_language text not null default 'ru' check (preferred_language in ('ru','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- cases: one investigation = one suspect (= one printable dossier sheet).
-- ---------------------------------------------------------------------------
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  suspect_name text not null,
  language text not null default 'ru' check (language in ('ru','en')),
  status text not null default 'draft' check (status in ('draft','interviewing','ready','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_owner_idx on public.cases(owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- interviews: one realtime conversation session for a case.
-- A case may have multiple interviews (re-takes), but only the latest
-- "completed" interview feeds the dossier composer.
-- ---------------------------------------------------------------------------
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','completed','aborted')),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  realtime_session_id text,
  cost_estimate_usd numeric(6,4),
  created_at timestamptz not null default now()
);
create index interviews_case_idx on public.interviews(case_id, created_at desc);

-- ---------------------------------------------------------------------------
-- messages: transcript of an interview, one row per turn.
-- role: 'detective' (avatar) | 'suspect' (player).
-- The detective's tool calls (e.g. record_evidence) land here as `tool` rows.
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  role text not null check (role in ('detective','suspect','system','tool')),
  content text not null,
  audio_path text,
  tool_name text,
  tool_payload jsonb,
  created_at timestamptz not null default now()
);
create index messages_interview_idx on public.messages(interview_id, created_at);

-- ---------------------------------------------------------------------------
-- evidence: structured facts collected during the interview.
-- Examples: hair_color = 'светлые', favorite_food = 'пицца', height_cm = 110.
-- The detective writes these via a tool call so the dossier composer has a
-- structured source rather than only a free-form transcript.
-- ---------------------------------------------------------------------------
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  interview_id uuid references public.interviews(id) on delete set null,
  category text not null,            -- e.g. 'identity','appearance','observations','funny_facts'
  key text not null,                 -- e.g. 'hair_color'
  value_text text,
  value_number numeric,
  value_json jsonb,
  confidence real default 0.8,       -- 0..1, how confident the detective is
  source text default 'interview' check (source in ('interview','upload','manual')),
  created_at timestamptz not null default now()
);
create index evidence_case_idx on public.evidence(case_id, category);
create unique index evidence_case_key_uniq on public.evidence(case_id, key);

-- ---------------------------------------------------------------------------
-- attachments: photos and other binary evidence (Storage paths).
-- The actual bytes live in the `evidence` storage bucket.
-- ---------------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  kind text not null check (kind in ('suspect_photo','generated_portrait','exhibit')),
  storage_path text not null,        -- bucket/object path
  mime_type text not null,
  width integer,
  height integer,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index attachments_case_idx on public.attachments(case_id, kind);

-- ---------------------------------------------------------------------------
-- dossiers: composed printable record. One per case.
-- `payload` is the structured JSON consumed by the print template.
-- `image_attachment_id` points to the generated cartoon portrait.
-- ---------------------------------------------------------------------------
create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.cases(id) on delete cascade,
  payload jsonb not null,
  image_attachment_id uuid references public.attachments(id) on delete set null,
  pdf_path text,                     -- storage path of last rendered PDF
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger cases_touch before update on public.cases
  for each row execute function public.touch_updated_at();
create trigger dossiers_touch before update on public.dossiers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- A player only ever sees their own cases and everything that belongs to them.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.interviews enable row level security;
alter table public.messages enable row level security;
alter table public.evidence enable row level security;
alter table public.attachments enable row level security;
alter table public.dossiers enable row level security;

create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles self upsert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

create policy "cases owner all" on public.cases
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Helper: a row in a child table is visible iff the parent case belongs to me.
create or replace function public.case_belongs_to_me(p_case_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cases c where c.id = p_case_id and c.owner_id = auth.uid()
  );
$$;

create policy "interviews via case" on public.interviews
  for all using (public.case_belongs_to_me(case_id))
  with check (public.case_belongs_to_me(case_id));

create policy "messages via interview" on public.messages
  for all using (
    public.case_belongs_to_me((select case_id from public.interviews i where i.id = interview_id))
  ) with check (
    public.case_belongs_to_me((select case_id from public.interviews i where i.id = interview_id))
  );

create policy "evidence via case" on public.evidence
  for all using (public.case_belongs_to_me(case_id))
  with check (public.case_belongs_to_me(case_id));

create policy "attachments via case" on public.attachments
  for all using (public.case_belongs_to_me(case_id))
  with check (public.case_belongs_to_me(case_id));

create policy "dossiers via case" on public.dossiers
  for all using (public.case_belongs_to_me(case_id))
  with check (public.case_belongs_to_me(case_id));
