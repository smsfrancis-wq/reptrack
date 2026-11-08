-- RepTrack cloud sync (run ONCE in Supabase -> SQL Editor -> New query).
-- Separate from any Reef Command tables. Authentication must be enabled.
-- Authenticated users may access ONLY their own snapshot. Anonymous access is denied.

create table if not exists public.reptrack_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.reptrack_data enable row level security;
revoke all on table public.reptrack_data from anon, authenticated;
grant select, insert, update on table public.reptrack_data to authenticated;

drop policy if exists "reptrack_select_own" on public.reptrack_data;
create policy "reptrack_select_own"
  on public.reptrack_data for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "reptrack_insert_own" on public.reptrack_data;
create policy "reptrack_insert_own"
  on public.reptrack_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "reptrack_update_own" on public.reptrack_data;
create policy "reptrack_update_own"
  on public.reptrack_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Optimistic concurrency: a second device cannot overwrite another device's
-- changes without first obtaining the newest revision. Uses invoker RLS.
create or replace function public.reptrack_write(p_data jsonb, p_revision bigint)
returns table(new_revision bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  own_user uuid := (select auth.uid());
  written_revision bigint;
begin
  if own_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Invalid workout payload';
  end if;
  if p_revision is null or p_revision < 0 then
    raise exception 'Invalid revision';
  end if;

  insert into public.reptrack_data (user_id,payload,revision,updated_at)
  values (own_user,p_data,1,now())
  on conflict (user_id) do update
    set payload = excluded.payload,
        revision = public.reptrack_data.revision + 1,
        updated_at = now()
    where public.reptrack_data.revision = p_revision
  returning revision into written_revision;

  if written_revision is null then
    raise exception 'SYNC_CONFLICT' using errcode='P0001';
  end if;
  return query select written_revision;
end;
$$;

revoke all on function public.reptrack_write(jsonb,bigint) from public, anon;
grant execute on function public.reptrack_write(jsonb,bigint) to authenticated;
