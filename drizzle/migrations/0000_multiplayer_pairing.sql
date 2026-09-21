-- Real two-device multiplayer: accounts are paired one-to-one, and the pair's
-- shared forest (placements, den, weather, footprint trail) lives here instead
-- of a single browser's localStorage. See src/world/engine.ts for the shape
-- this mirrors, and src/world/pairing.functions.ts for how rows are written.
--
-- This migration is NOT applied automatically — Claude Code has no service-role
-- credentials or Supabase CLI session in this environment. Apply it yourself
-- with `supabase db push`, or ask the Lovable editor to run it, before Phase 1
-- code is exercised against the live project.

create table public.pairings (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid references auth.users (id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  constraint pairings_distinct_participants check (companion_id is null or companion_id <> inviter_id)
);

-- v1: one pairing per person, as either side.
create unique index pairings_inviter_unique on public.pairings (inviter_id);
create unique index pairings_companion_unique on public.pairings (companion_id) where companion_id is not null;

create table public.world_state (
  pairing_id uuid primary key references public.pairings (id) on delete cascade,
  weather_kind text not null default 'clear',
  weather_by uuid references auth.users (id),
  weather_at timestamptz not null default now(),
  den jsonb not null default '{"discovered":false,"rests":0,"bedding":[],"keepsakes":[],"invitation":null}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.placements (
  id text primary key,
  pairing_id uuid not null references public.pairings (id) on delete cascade,
  kind text not null,
  x double precision not null,
  y double precision not null,
  variant integer not null,
  by uuid not null references auth.users (id),
  at timestamptz not null default now()
);
create index placements_pairing_idx on public.placements (pairing_id, at);

create table public.footprints (
  id bigint generated always as identity primary key,
  pairing_id uuid not null references public.pairings (id) on delete cascade,
  x double precision not null,
  y double precision not null,
  angle double precision not null,
  by uuid not null references auth.users (id),
  at timestamptz not null default now()
);
create index footprints_pairing_idx on public.footprints (pairing_id, at);

-- helper used by every policy below: is the current user part of this pairing?
create function public.is_pairing_member(target_pairing_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pairings
    where id = target_pairing_id
      and (inviter_id = auth.uid() or companion_id = auth.uid())
  );
$$;

alter table public.pairings enable row level security;
alter table public.world_state enable row level security;
alter table public.placements enable row level security;
alter table public.footprints enable row level security;

-- pairings: a member can read their own row; only the row's own participants
-- can ever update it (accepting an invite sets companion_id — see
-- pairing.functions.ts, which uses the service-role client for that specific
-- step since the joiner isn't a member until the update succeeds).
create policy "pairing members can read their pairing"
  on public.pairings for select
  using (inviter_id = auth.uid() or companion_id = auth.uid());

create policy "inviter can create a pairing"
  on public.pairings for insert
  with check (inviter_id = auth.uid());

-- world_state / placements / footprints: standard "must be a member" gate.
create policy "pairing members can read world_state"
  on public.world_state for select
  using (public.is_pairing_member(pairing_id));
create policy "pairing members can upsert world_state"
  on public.world_state for insert
  with check (public.is_pairing_member(pairing_id));
create policy "pairing members can update world_state"
  on public.world_state for update
  using (public.is_pairing_member(pairing_id));

create policy "pairing members can read placements"
  on public.placements for select
  using (public.is_pairing_member(pairing_id));
create policy "pairing members can insert placements"
  on public.placements for insert
  with check (public.is_pairing_member(pairing_id) and by = auth.uid());

create policy "pairing members can read footprints"
  on public.footprints for select
  using (public.is_pairing_member(pairing_id));
create policy "pairing members can insert footprints"
  on public.footprints for insert
  with check (public.is_pairing_member(pairing_id) and by = auth.uid());

-- keep Realtime informed of row changes for postgres_changes subscriptions
alter publication supabase_realtime add table public.placements;
alter publication supabase_realtime add table public.world_state;