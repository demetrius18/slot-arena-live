-- SLOT ARENA LIVE 2.0
-- Incolla ed esegui questo file in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Slot Arena Live',
  status text not null default 'draft' check (status in ('draft', 'live', 'completed')),
  state jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tournaments_status_created_idx
  on public.tournaments (status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at
before update on public.tournaments
for each row execute function public.set_updated_at();

alter table public.tournaments enable row level security;

drop policy if exists "Tornei leggibili dal monitor" on public.tournaments;
create policy "Tornei leggibili dal monitor"
on public.tournaments for select
to anon, authenticated
using (true);

drop policy if exists "Admin crea i propri tornei" on public.tournaments;
create policy "Admin crea i propri tornei"
on public.tournaments for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Admin modifica i propri tornei" on public.tournaments;
create policy "Admin modifica i propri tornei"
on public.tournaments for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "Admin elimina i propri tornei" on public.tournaments;
create policy "Admin elimina i propri tornei"
on public.tournaments for delete
to authenticated
using ((select auth.uid()) = owner_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tournaments'
  ) then
    alter publication supabase_realtime add table public.tournaments;
  end if;
end $$;

-- Forza l'API Supabase a riconoscere immediatamente la nuova tabella.
notify pgrst, 'reload schema';
