-- Supabase foundation for IndiFrame Agent Command Centre.
-- Apply only to a dedicated Supabase project after reviewing the target project.

begin;

create table if not exists public.agent_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'agent' check (role in ('manager','agent')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_kpis (
  id uuid primary key default gen_random_uuid(),
  agent_user_id uuid not null references public.agent_profiles(user_id) on delete cascade,
  work_date date not null,
  calls_assigned integer not null default 0 check (calls_assigned >= 0),
  outbound_attempts integer not null default 0 check (outbound_attempts >= 0),
  inbound_calls integer not null default 0 check (inbound_calls >= 0),
  connected_calls integer not null default 0 check (connected_calls >= 0),
  qualified_leads integer not null default 0 check (qualified_leads >= 0),
  consultations_booked integer not null default 0 check (consultations_booked >= 0),
  whatsapp_shared integer not null default 0 check (whatsapp_shared >= 0),
  callbacks_scheduled integer not null default 0 check (callbacks_scheduled >= 0),
  followups_completed integer not null default 0 check (followups_completed >= 0),
  crm_updated integer not null default 0 check (crm_updated >= 0),
  talk_time_minutes numeric(10,2) not null default 0 check (talk_time_minutes >= 0),
  notes text not null default '',
  updated_by uuid not null references public.agent_profiles(user_id),
  updated_at timestamptz not null default now(),
  unique(agent_user_id, work_date)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.agent_profiles(user_id) on delete cascade,
  quiz_date date not null default current_date,
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and total <= 50),
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (score <= total)
);

create table if not exists public.simulation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.agent_profiles(user_id) on delete cascade,
  scenario text not null,
  score integer not null check (score between 0 and 100),
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists daily_kpis_agent_date_idx
  on public.daily_kpis(agent_user_id, work_date desc);
create index if not exists quiz_attempts_user_date_idx
  on public.quiz_attempts(user_id, quiz_date desc);
create index if not exists simulation_attempts_user_created_idx
  on public.simulation_attempts(user_id, created_at desc);

-- Role assignment is derived from the verified Supabase Auth email.
-- No browser-supplied role is trusted.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.agent_profiles(user_id, email, display_name, role)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when lower(coalesce(new.email, '')) = 'mahesh.s@hrhnext.com' then 'manager'
      else 'agent'
    end
  )
  on conflict (user_id) do update
    set email = excluded.email,
        role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_agent_profile on auth.users;
create trigger on_auth_user_created_agent_profile
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Backfill users already present in Supabase Auth when this migration is applied.
insert into public.agent_profiles(user_id, email, display_name, role)
select
  id,
  lower(coalesce(email, '')),
  coalesce(raw_user_meta_data ->> 'full_name', ''),
  case
    when lower(coalesce(email, '')) = 'mahesh.s@hrhnext.com' then 'manager'
    else 'agent'
  end
from auth.users
on conflict (user_id) do update
  set email = excluded.email,
      role = excluded.role;

-- SECURITY DEFINER avoids recursive RLS evaluation when policies inspect profiles.
create or replace function public.is_active_agent_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.agent_profiles p
    where p.user_id = auth.uid()
      and p.active = true
  );
$$;

create or replace function public.is_authorized_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.agent_profiles p
    where p.user_id = auth.uid()
      and p.active = true
      and p.role = 'manager'
      and lower(p.email) = 'mahesh.s@hrhnext.com'
  );
$$;

create or replace function public.manager_update_agent_profile(
  target_user_id uuid,
  new_display_name text,
  new_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_authorized_manager() then
    raise exception 'Authorised manager access required';
  end if;

  if not exists (
    select 1 from public.agent_profiles
    where user_id = target_user_id and role = 'agent'
  ) then
    raise exception 'Target must be a registered agent';
  end if;

  update public.agent_profiles
  set display_name = left(coalesce(new_display_name, ''), 80),
      active = new_active
  where user_id = target_user_id;
end;
$$;

alter table public.agent_profiles enable row level security;
alter table public.daily_kpis enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.simulation_attempts enable row level security;

drop policy if exists "profiles_read_own_or_manager" on public.agent_profiles;
create policy "profiles_read_own_or_manager"
  on public.agent_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_authorized_manager());

drop policy if exists "profiles_update_own_display_name" on public.agent_profiles;
create policy "profiles_update_own_display_name"
  on public.agent_profiles for update to authenticated
  using (user_id = auth.uid() and active = true)
  with check (user_id = auth.uid() and active = true);

drop policy if exists "kpi_read_own_or_manager" on public.daily_kpis;
create policy "kpi_read_own_or_manager"
  on public.daily_kpis for select to authenticated
  using (
    public.is_active_agent_user()
    and (agent_user_id = auth.uid() or public.is_authorized_manager())
  );

drop policy if exists "kpi_manager_insert" on public.daily_kpis;
create policy "kpi_manager_insert"
  on public.daily_kpis for insert to authenticated
  with check (public.is_authorized_manager());

drop policy if exists "kpi_manager_update" on public.daily_kpis;
create policy "kpi_manager_update"
  on public.daily_kpis for update to authenticated
  using (public.is_authorized_manager())
  with check (public.is_authorized_manager());

drop policy if exists "kpi_manager_delete" on public.daily_kpis;
create policy "kpi_manager_delete"
  on public.daily_kpis for delete to authenticated
  using (public.is_authorized_manager());

drop policy if exists "quiz_read_own_or_manager" on public.quiz_attempts;
create policy "quiz_read_own_or_manager"
  on public.quiz_attempts for select to authenticated
  using (
    public.is_active_agent_user()
    and (user_id = auth.uid() or public.is_authorized_manager())
  );

drop policy if exists "quiz_insert_own" on public.quiz_attempts;
create policy "quiz_insert_own"
  on public.quiz_attempts for insert to authenticated
  with check (public.is_active_agent_user() and user_id = auth.uid());

drop policy if exists "simulation_read_own_or_manager" on public.simulation_attempts;
create policy "simulation_read_own_or_manager"
  on public.simulation_attempts for select to authenticated
  using (
    public.is_active_agent_user()
    and (user_id = auth.uid() or public.is_authorized_manager())
  );

-- No INSERT/UPDATE/DELETE policy for authenticated on simulation_attempts:
-- only the trusted server-side AI function should save evaluated attempts.

-- Restrict profile updates to the display_name column. Account status and role
-- are changed only by the manager RPC / trusted Auth trigger.
revoke all on public.agent_profiles from anon, authenticated;
grant select on public.agent_profiles to authenticated;
grant update (display_name) on public.agent_profiles to authenticated;

revoke all on public.daily_kpis from anon, authenticated;
grant select, insert, update, delete on public.daily_kpis to authenticated;

revoke all on public.quiz_attempts from anon, authenticated;
grant select, insert on public.quiz_attempts to authenticated;

revoke all on public.simulation_attempts from anon, authenticated;
grant select on public.simulation_attempts to authenticated;

revoke all on function public.manager_update_agent_profile(uuid, text, boolean) from public, anon;
grant execute on function public.manager_update_agent_profile(uuid, text, boolean) to authenticated;

revoke all on function public.is_active_agent_user() from public, anon;
grant execute on function public.is_active_agent_user() to authenticated;

revoke all on function public.is_authorized_manager() from public, anon;
grant execute on function public.is_authorized_manager() to authenticated;

commit;
