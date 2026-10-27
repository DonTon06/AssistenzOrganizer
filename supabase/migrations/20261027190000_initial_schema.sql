-- Assistenz-Planer: initial schema.
--
-- Eight tables cover the MVP: profiles, teams, memberships, invites,
-- planning_months, day_needs, offers and swap_requests. Every team-owned row
-- carries a team_id so that row-level security can scope all access to the
-- caller's own teams. PIN credentials live in the private schema, which the
-- API does not expose.
--
-- Roles live on the membership, not on the user, and a person can be in
-- several teams: an assistant can work for several employers.
--   employer  Arbeitgeber*in, the person with a disability, one per team
--   proxy     Vertretung (family member or legal guardian), can do everything
--             the employer can, on their behalf
--   assistant Assistent*in
-- "Manager" below means employer or proxy.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.team_role as enum ('employer', 'proxy', 'assistant');
create type public.month_status as enum ('open', 'in_review', 'published');
-- handed_over: an approved shift that moved to a colleague or was dropped
-- through an authorized swap or sick request.
create type public.offer_status as enum ('submitted', 'approved', 'declined', 'withdrawn', 'handed_over');
create type public.swap_reason as enum ('swap', 'sick');
create type public.swap_status as enum ('open', 'accepted', 'authorized', 'declined', 'withdrawn');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 100),
  -- Contact details for notifications. Sign-in does not use them.
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  employer_id uuid not null references public.profiles (id) on delete restrict,
  -- Day of the previous month on which offers are due (spec default: the 15th).
  default_deadline_day smallint not null default 15 check (default_deadline_day between 1 and 28),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.team_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- One employer per team.
create unique index memberships_one_employer_per_team
  on public.memberships (team_id) where role = 'employer';
create index memberships_user_id_idx on public.memberships (user_id);

-- An invite link. Three kinds:
--   * employer invite (role employer, no team yet): creates a new team when
--     redeemed. Only the operator creates these, with the service key.
--   * join invite (role proxy or assistant): adds a new person to a team.
--   * access link (for_user_id set): lets an existing member sign in on a new
--     device or after forgetting the PIN.
-- Each link works once.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams (id) on delete cascade,
  role public.team_role not null default 'assistant',
  team_name text check (char_length(btrim(team_name)) between 1 and 100),
  for_user_id uuid references public.profiles (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  check (
    (role = 'employer' and team_id is null and team_name is not null and for_user_id is null)
    or (role <> 'employer' and team_id is not null)
  )
);

create index invites_team_id_idx on public.invites (team_id);

create table public.planning_months (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- First day of the month being planned, e.g. 2026-12-01.
  month date not null check (extract(day from month) = 1),
  -- Offers are due by the end of this day (Europe/Berlin). Later offers are
  -- still accepted until the planned month ends, and are marked as late
  -- ("verspätet") so managers see them in their own list.
  deadline date not null,
  status public.month_status not null default 'open',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, month),
  -- Lets child rows reference (id, team_id) so their team always matches the month's.
  unique (id, team_id),
  check (deadline < month + interval '1 month')
);

-- Hours of assistance a day needs (Tagesbedarf). Drives the gap view:
-- gap = hours needed - approved hours.
create table public.day_needs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  planning_month_id uuid not null,
  date date not null,
  hours numeric(4, 2) not null check (hours between 0 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_month_id, date),
  foreign key (planning_month_id, team_id)
    references public.planning_months (id, team_id) on delete cascade
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  planning_month_id uuid not null,
  assistant_id uuid not null,
  date date not null,
  -- Whole, half or quarter day. These are amounts of time, not fixed slots:
  -- two half days on one date can both be approved.
  size numeric(3, 2) not null check (size in (1, 0.5, 0.25)),
  -- A whole day is 24 hours.
  hours numeric(4, 2) generated always as (size * 24) stored,
  note text check (char_length(note) <= 500),
  status public.offer_status not null default 'submitted',
  -- Made after the deadline ("verspätet").
  is_late boolean not null default false,
  decision_comment text check (char_length(decision_comment) <= 500),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  -- Set when the shift was taken over from a colleague through a swap.
  source_swap_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (planning_month_id, team_id)
    references public.planning_months (id, team_id) on delete cascade,
  -- The assistant must be a member of the team.
  foreign key (team_id, assistant_id)
    references public.memberships (team_id, user_id) on delete cascade
);

-- One live offer per assistant and day. Shifts taken over in a swap are extra.
create unique index offers_one_live_offer_per_day
  on public.offers (planning_month_id, assistant_id, date)
  where status in ('submitted', 'approved') and source_swap_id is null;
create index offers_team_date_idx on public.offers (team_id, date);
create index offers_assistant_idx on public.offers (assistant_id);

-- A request to hand an approved shift to a colleague (swap) or to report sick.
-- Directed at one colleague, or open to the whole team when to_assistant_id
-- is empty. A colleague accepts, then a manager authorizes.
create table public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete cascade,
  from_assistant_id uuid not null references public.profiles (id) on delete cascade,
  to_assistant_id uuid references public.profiles (id) on delete cascade,
  reason public.swap_reason not null default 'swap',
  note text check (char_length(note) <= 500),
  status public.swap_status not null default 'open',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_assistant_id is null or to_assistant_id <> from_assistant_id)
);

-- One pending request per shift.
create unique index swap_requests_one_pending_per_offer
  on public.swap_requests (offer_id) where status in ('open', 'accepted');
create index swap_requests_team_idx on public.swap_requests (team_id, status);

alter table public.offers
  add foreign key (source_swap_id) references public.swap_requests (id) on delete set null;

-- PINs, outside the API. Only server code with the service key reaches them,
-- through the functions below.
create schema if not exists private;
revoke all on schema private from public;

create table private.pin_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions used by policies and triggers
-- ---------------------------------------------------------------------------

-- Today's date in Germany; deadlines are calendar days in Europe/Berlin.
create function public.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Berlin')::date;
$$;

create function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where team_id = p_team_id and user_id = auth.uid() and active
  );
$$;

-- Employer or proxy.
create function public.is_team_manager(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where team_id = p_team_id and user_id = auth.uid() and active
      and role in ('employer', 'proxy')
  );
$$;

create function public.is_team_assistant(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where team_id = p_team_id and user_id = auth.uid() and active and role = 'assistant'
  );
$$;

-- True when the caller and p_user_id are in at least one team together.
create function public.shares_team_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.team_id = mine.team_id
    where mine.user_id = auth.uid() and mine.active and theirs.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger teams_set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger planning_months_set_updated_at before update on public.planning_months
  for each row execute function public.set_updated_at();
create trigger day_needs_set_updated_at before update on public.day_needs
  for each row execute function public.set_updated_at();
create trigger offers_set_updated_at before update on public.offers
  for each row execute function public.set_updated_at();
create trigger swap_requests_set_updated_at before update on public.swap_requests
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stamp published_at when a month is published.
create function public.planning_months_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  elsif new.status <> 'published' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger planning_months_before_write before insert or update on public.planning_months
  for each row execute function public.planning_months_before_write();

-- Dates of day needs must fall in their planning month.
create function public.day_needs_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if date_trunc('month', new.date)::date <> (
    select month from public.planning_months where id = new.planning_month_id
  ) then
    raise exception 'Das Datum liegt nicht im Planungsmonat.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger day_needs_before_write before insert or update on public.day_needs
  for each row execute function public.day_needs_before_write();

-- Access links may only be made for members the creator may stand in for:
-- managers for assistants, and the employer also for proxies.
create function public.invites_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.team_role;
begin
  if new.for_user_id is null or auth.uid() is null then
    return new;
  end if;

  select role into v_target_role from public.memberships
  where team_id = new.team_id and user_id = new.for_user_id;

  if v_target_role is null then
    raise exception 'Diese Person gehört nicht zum Team.' using errcode = 'check_violation';
  end if;
  new.role := v_target_role;

  if v_target_role = 'employer'
    or (v_target_role = 'proxy' and not exists (
      select 1 from public.memberships
      where team_id = new.team_id and user_id = auth.uid() and role = 'employer' and active
    )) then
    raise exception 'Für diese Person kannst du keinen Zugangslink erstellen.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger invites_before_insert before insert on public.invites
  for each row execute function public.invites_before_insert();

-- Enforces who may change what on an offer. RLS decides which rows a caller
-- can touch; this trigger decides which changes are allowed on them.
-- Calls without a user (service role, SQL editor) are not restricted.
create function public.offers_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month public.planning_months;
  v_uid uuid := auth.uid();
begin
  select * into v_month from public.planning_months where id = new.planning_month_id;

  if date_trunc('month', new.date)::date <> v_month.month then
    raise exception 'Das Datum liegt nicht im Planungsmonat.' using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and (
    new.team_id <> old.team_id
    or new.planning_month_id <> old.planning_month_id
    or new.assistant_id <> old.assistant_id
    or new.date <> old.date
    or new.source_swap_id is distinct from old.source_swap_id
  ) then
    raise exception 'Team, Monat, Person und Datum eines Angebots sind unveränderlich.'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    new.is_late := public.berlin_today() > v_month.deadline;
  else
    new.is_late := old.is_late;
  end if;

  if v_uid is null then
    return new;
  end if;

  if public.is_team_manager(new.team_id) then
    -- Managers decide; the note belongs to the assistant.
    if tg_op = 'UPDATE' and new.note is distinct from old.note then
      raise exception 'Die Notiz kann nur die Assistenz ändern.' using errcode = 'insufficient_privilege';
    end if;
    if new.status = 'handed_over' and (tg_op = 'INSERT' or old.status <> 'handed_over')
      and coalesce(current_setting('app.authorizing_swap', true), '') <> 'on' then
      raise exception 'Schichten werden über Tauschanfragen übergeben.' using errcode = 'insufficient_privilege';
    end if;
    if tg_op = 'INSERT' or new.status is distinct from old.status then
      if new.status in ('approved', 'declined') then
        new.decided_at := now();
        new.decided_by := v_uid;
      else
        new.decided_at := null;
        new.decided_by := null;
      end if;
    end if;
    return new;
  end if;

  -- From here on the caller is the assistant who owns the offer.
  if new.assistant_id <> v_uid then
    raise exception 'Keine Berechtigung für dieses Angebot.' using errcode = 'insufficient_privilege';
  end if;

  -- Offers, late ones included, are possible until the planned month ends.
  if public.berlin_today() >= (v_month.month + interval '1 month')::date then
    raise exception 'Dieser Monat ist vorbei.' using errcode = 'insufficient_privilege';
  end if;

  -- Assistants can change or withdraw an offer until it is decided.
  if new.status not in ('submitted', 'withdrawn')
    or (tg_op = 'UPDATE' and old.status not in ('submitted', 'withdrawn')) then
    raise exception 'Über Angebote entscheidet die Arbeitgeberin oder der Arbeitgeber.'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'INSERT' then
    new.decision_comment := null;
    new.decided_at := null;
    new.decided_by := null;
    new.source_swap_id := null;
  elsif new.decision_comment is distinct from old.decision_comment
    or new.decided_at is distinct from old.decided_at
    or new.decided_by is distinct from old.decided_by then
    raise exception 'Über Angebote entscheidet die Arbeitgeberin oder der Arbeitgeber.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger offers_before_write before insert or update on public.offers
  for each row execute function public.offers_before_write();

-- ---------------------------------------------------------------------------
-- Team and invite functions
-- ---------------------------------------------------------------------------

-- What the join screen shows before anyone is signed in. Token holders only.
create function public.get_invite(p_token text)
returns table (
  role public.team_role,
  team_name text,
  employer_name text,
  for_user_name text,
  valid boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.role,
         coalesce(t.name, i.team_name),
         e.name,
         f.name,
         (i.used_by is null and i.expires_at > now())
  from public.invites i
  left join public.teams t on t.id = i.team_id
  left join public.profiles e on e.id = t.employer_id
  left join public.profiles f on f.id = i.for_user_id
  where i.token = p_token;
$$;

-- Redeems an invite for p_user_id: creates the team for an employer invite,
-- adds or reactivates the membership for a join invite, and checks the person
-- for an access link. Returns the team id. Called by the server with the
-- service key, after it has created or identified the user.
create function public.redeem_invite(p_token text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites;
  v_team_id uuid;
begin
  select * into v_invite from public.invites where token = p_token for update;

  if not found then
    raise exception 'Einladung nicht gefunden.' using errcode = 'no_data_found';
  end if;
  if v_invite.used_by is not null or v_invite.expires_at <= now() then
    raise exception 'Diese Einladung ist abgelaufen oder wurde schon benutzt.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_invite.for_user_id is not null then
    if v_invite.for_user_id <> p_user_id then
      raise exception 'Dieser Zugangslink gehört zu einer anderen Person.'
        using errcode = 'insufficient_privilege';
    end if;
    v_team_id := v_invite.team_id;
  elsif v_invite.role = 'employer' then
    insert into public.teams (name, employer_id) values (btrim(v_invite.team_name), p_user_id)
    returning id into v_team_id;
    insert into public.memberships (team_id, user_id, role) values (v_team_id, p_user_id, 'employer');
  else
    v_team_id := v_invite.team_id;
    insert into public.memberships (team_id, user_id, role)
    values (v_team_id, p_user_id, v_invite.role)
    on conflict (team_id, user_id) do update set active = true;
  end if;

  update public.invites set used_by = p_user_id, used_at = now() where id = v_invite.id;

  return v_team_id;
end;
$$;

-- Opens planning for a month (idempotent). Managers only.
-- The deadline defaults to the team's deadline day in the month before.
create function public.open_planning_month(p_team_id uuid, p_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_deadline_day smallint;
  v_id uuid;
begin
  if not public.is_team_manager(p_team_id) then
    raise exception 'Nur Arbeitgeber*in oder Vertretung können Monate öffnen.'
      using errcode = 'insufficient_privilege';
  end if;

  select id into v_id from public.planning_months where team_id = p_team_id and month = v_month;
  if found then
    return v_id;
  end if;

  select default_deadline_day into v_deadline_day from public.teams where id = p_team_id;

  insert into public.planning_months (team_id, month, deadline)
  values (p_team_id, v_month, (v_month - interval '1 month')::date + (v_deadline_day - 1))
  returning id into v_id;

  return v_id;
end;
$$;

-- The caller's approved shifts in their other teams between two dates, so the
-- offer screen can warn about clashes. Assistants may work for several employers.
create function public.my_shifts_in_other_teams(p_team_id uuid, p_from date, p_to date)
returns table (date date, team_name text, hours numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select o.date, t.name, sum(o.hours)
  from public.offers o
  join public.teams t on t.id = o.team_id
  join public.planning_months pm on pm.id = o.planning_month_id
  join public.memberships m on m.team_id = o.team_id and m.user_id = o.assistant_id and m.active
  where o.assistant_id = auth.uid()
    and o.team_id <> p_team_id
    and o.status = 'approved'
    and pm.status = 'published'
    and o.date between p_from and p_to
  group by o.date, t.name
  order by o.date, t.name;
$$;

-- ---------------------------------------------------------------------------
-- Swap and sick requests. All changes go through these functions.
-- ---------------------------------------------------------------------------

-- An assistant offers one of their approved, published shifts to a colleague
-- (p_to_assistant_id) or to the whole team (null).
create function public.create_swap_request(
  p_offer_id uuid,
  p_to_assistant_id uuid default null,
  p_reason public.swap_reason default 'swap',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_id uuid;
begin
  select * into v_offer from public.offers where id = p_offer_id;

  if not found or v_offer.assistant_id <> auth.uid() or not public.is_team_assistant(v_offer.team_id) then
    raise exception 'Keine Berechtigung für diese Schicht.' using errcode = 'insufficient_privilege';
  end if;
  if v_offer.status <> 'approved' or not exists (
    select 1 from public.planning_months where id = v_offer.planning_month_id and status = 'published'
  ) then
    raise exception 'Nur bestätigte Schichten im veröffentlichten Dienstplan können getauscht werden.'
      using errcode = 'check_violation';
  end if;
  if p_to_assistant_id is not null and not exists (
    select 1 from public.memberships
    where team_id = v_offer.team_id and user_id = p_to_assistant_id and role = 'assistant' and active
  ) then
    raise exception 'Diese Person gehört nicht zum Team.' using errcode = 'check_violation';
  end if;

  insert into public.swap_requests (team_id, offer_id, from_assistant_id, to_assistant_id, reason, note)
  values (v_offer.team_id, v_offer.id, v_offer.assistant_id, p_to_assistant_id, p_reason, p_note)
  returning id into v_id;

  return v_id;
end;
$$;

-- A colleague takes over the shift. Needs a manager's authorization after.
create function public.accept_swap_request(p_swap_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_swap public.swap_requests;
begin
  select * into v_swap from public.swap_requests where id = p_swap_id for update;

  if not found or not public.is_team_assistant(v_swap.team_id)
    or v_swap.from_assistant_id = auth.uid()
    or (v_swap.to_assistant_id is not null and v_swap.to_assistant_id <> auth.uid()) then
    raise exception 'Keine Berechtigung für diese Anfrage.' using errcode = 'insufficient_privilege';
  end if;
  if v_swap.status <> 'open' then
    raise exception 'Diese Anfrage ist nicht mehr offen.' using errcode = 'check_violation';
  end if;

  update public.swap_requests
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = p_swap_id;
end;
$$;

-- The requester withdraws, the addressed colleague says no, or a manager declines.
create function public.decline_swap_request(p_swap_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_swap public.swap_requests;
  v_uid uuid := auth.uid();
begin
  select * into v_swap from public.swap_requests where id = p_swap_id for update;

  if not found then
    raise exception 'Anfrage nicht gefunden.' using errcode = 'no_data_found';
  end if;
  if v_swap.status not in ('open', 'accepted') then
    raise exception 'Diese Anfrage ist schon erledigt.' using errcode = 'check_violation';
  end if;

  if v_swap.from_assistant_id = v_uid then
    update public.swap_requests set status = 'withdrawn' where id = p_swap_id;
  elsif public.is_team_manager(v_swap.team_id)
    or (v_swap.to_assistant_id = v_uid and v_swap.status = 'open') then
    update public.swap_requests
    set status = 'declined', decided_by = v_uid, decided_at = now()
    where id = p_swap_id;
  else
    raise exception 'Keine Berechtigung für diese Anfrage.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- A manager authorizes. The original shift is marked handed_over and the
-- colleague who accepted gets an approved shift of the same size. A sick
-- report can be authorized without a replacement; the day then shows a gap.
create function public.authorize_swap_request(p_swap_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_swap public.swap_requests;
  v_offer public.offers;
begin
  select * into v_swap from public.swap_requests where id = p_swap_id for update;

  if not found or not public.is_team_manager(v_swap.team_id) then
    raise exception 'Nur Arbeitgeber*in oder Vertretung können Tausche freigeben.'
      using errcode = 'insufficient_privilege';
  end if;
  if not (v_swap.status = 'accepted' or (v_swap.status = 'open' and v_swap.reason = 'sick')) then
    raise exception 'Ein Tausch braucht erst eine Kollegin oder einen Kollegen, die oder der übernimmt.'
      using errcode = 'check_violation';
  end if;

  select * into v_offer from public.offers where id = v_swap.offer_id for update;
  if v_offer.status <> 'approved' then
    raise exception 'Die Schicht ist nicht mehr bestätigt.' using errcode = 'check_violation';
  end if;

  -- Lets the offer trigger accept the hand-over for this transaction only.
  perform set_config('app.authorizing_swap', 'on', true);
  update public.offers set status = 'handed_over' where id = v_offer.id;

  if v_swap.accepted_by is not null then
    insert into public.offers (
      team_id, planning_month_id, assistant_id, date, size, note, status, source_swap_id
    ) values (
      v_offer.team_id, v_offer.planning_month_id, v_swap.accepted_by, v_offer.date, v_offer.size,
      v_offer.note, 'approved', v_swap.id
    );
  end if;

  update public.swap_requests
  set status = 'authorized', decided_by = auth.uid(), decided_at = now()
  where id = p_swap_id;

  perform set_config('app.authorizing_swap', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- PIN sign-in. Called only by server code with the service key.
-- ---------------------------------------------------------------------------

create function public.set_pin(p_user_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_pin !~ '^[0-9]{6}$' then
    raise exception 'Die PIN muss aus 6 Ziffern bestehen.' using errcode = 'check_violation';
  end if;

  insert into private.pin_credentials (user_id, pin_hash)
  values (p_user_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  on conflict (user_id) do update
  set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
end;
$$;

-- Checks a PIN with a lockout: after 5 wrong tries the account locks for
-- 15 minutes, and each further wrong try doubles the lock (up to a day).
-- Returns ok, wrong, locked or no_pin, plus when a lock ends.
create function public.check_pin(p_user_id uuid, p_pin text)
returns table (result text, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cred private.pin_credentials;
  v_lock interval;
begin
  select * into v_cred from private.pin_credentials where user_id = p_user_id for update;

  if not found then
    return query select 'no_pin'::text, null::timestamptz;
    return;
  end if;
  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return query select 'locked'::text, v_cred.locked_until;
    return;
  end if;

  if v_cred.pin_hash = extensions.crypt(p_pin, v_cred.pin_hash) then
    update private.pin_credentials
    set failed_attempts = 0, locked_until = null
    where user_id = p_user_id;
    return query select 'ok'::text, null::timestamptz;
    return;
  end if;

  v_cred.failed_attempts := v_cred.failed_attempts + 1;
  if v_cred.failed_attempts >= 5 then
    v_lock := least(interval '15 minutes' * power(2, v_cred.failed_attempts - 5), interval '1 day');
    v_cred.locked_until := now() + v_lock;
  end if;

  update private.pin_credentials
  set failed_attempts = v_cred.failed_attempts, locked_until = v_cred.locked_until
  where user_id = p_user_id;

  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return query select 'locked'::text, v_cred.locked_until;
  else
    return query select 'wrong'::text, null::timestamptz;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.planning_months enable row level security;
alter table public.day_needs enable row level security;
alter table public.offers enable row level security;
alter table public.swap_requests enable row level security;
alter table private.pin_credentials enable row level security;

create policy "Profiles: see yourself and your teammates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_team_with(id));
create policy "Profiles: edit yourself" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Teams: members can see their team" on public.teams
  for select to authenticated
  using (public.is_team_member(id));
create policy "Teams: managers can edit" on public.teams
  for update to authenticated
  using (public.is_team_manager(id)) with check (public.is_team_manager(id));

create policy "Memberships: see your own and your teams' members" on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_team_member(team_id));
create policy "Memberships: managers can deactivate assistants and proxies" on public.memberships
  for update to authenticated
  using (public.is_team_manager(team_id) and role <> 'employer')
  with check (public.is_team_manager(team_id) and role <> 'employer');

create policy "Invites: managers can see" on public.invites
  for select to authenticated
  using (public.is_team_manager(team_id));
create policy "Invites: managers can invite assistants and proxies" on public.invites
  for insert to authenticated
  with check (public.is_team_manager(team_id) and role in ('assistant', 'proxy'));
create policy "Invites: managers can delete" on public.invites
  for delete to authenticated
  using (public.is_team_manager(team_id));

create policy "Planning months: members can see" on public.planning_months
  for select to authenticated
  using (public.is_team_member(team_id));
create policy "Planning months: managers can create" on public.planning_months
  for insert to authenticated
  with check (public.is_team_manager(team_id));
create policy "Planning months: managers can edit" on public.planning_months
  for update to authenticated
  using (public.is_team_manager(team_id)) with check (public.is_team_manager(team_id));

create policy "Day needs: members can see" on public.day_needs
  for select to authenticated
  using (public.is_team_member(team_id));
create policy "Day needs: managers can create" on public.day_needs
  for insert to authenticated
  with check (public.is_team_manager(team_id));
create policy "Day needs: managers can edit" on public.day_needs
  for update to authenticated
  using (public.is_team_manager(team_id)) with check (public.is_team_manager(team_id));
create policy "Day needs: managers can delete" on public.day_needs
  for delete to authenticated
  using (public.is_team_manager(team_id));

-- Managers see every offer of their team. Assistants see their own offers,
-- and everyone's approved shifts once a month is published.
create policy "Offers: see own, team's as manager, or published schedule" on public.offers
  for select to authenticated
  using (
    public.is_team_manager(team_id)
    or (assistant_id = auth.uid() and public.is_team_member(team_id))
    or (
      status = 'approved'
      and public.is_team_member(team_id)
      and exists (
        select 1 from public.planning_months pm
        where pm.id = planning_month_id and pm.status = 'published'
      )
    )
  );
create policy "Offers: assistants offer for themselves, managers for the team" on public.offers
  for insert to authenticated
  with check (
    (assistant_id = auth.uid() and public.is_team_assistant(team_id))
    or public.is_team_manager(team_id)
  );
create policy "Offers: assistant edits own, managers decide" on public.offers
  for update to authenticated
  using (
    (assistant_id = auth.uid() and public.is_team_assistant(team_id))
    or public.is_team_manager(team_id)
  )
  with check (
    (assistant_id = auth.uid() and public.is_team_assistant(team_id))
    or public.is_team_manager(team_id)
  );
-- No delete policy: offers are withdrawn, not deleted, so history stays.

-- Managers see all requests. Assistants see their own, those addressed to
-- them, those they took over, and the open wishes posted to the whole team.
create policy "Swap requests: see relevant ones" on public.swap_requests
  for select to authenticated
  using (
    public.is_team_manager(team_id)
    or (
      public.is_team_member(team_id)
      and (
        from_assistant_id = auth.uid()
        or to_assistant_id = auth.uid()
        or accepted_by = auth.uid()
        or (to_assistant_id is null and status = 'open')
      )
    )
  );
-- No write policies: changes go through the swap functions above.

-- ---------------------------------------------------------------------------
-- Grants. Supabase grants everything to anon and authenticated by default;
-- narrow that to the columns each role may write. RLS still applies on top.
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.teams, public.memberships, public.invites,
  public.planning_months, public.day_needs, public.offers, public.swap_requests from anon;
revoke insert, update, delete on public.profiles, public.teams, public.memberships,
  public.invites, public.planning_months, public.day_needs, public.offers,
  public.swap_requests from authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

grant update (name, email, phone, notify_email, notify_push) on public.profiles to authenticated;
grant update (name, default_deadline_day) on public.teams to authenticated;
grant update (active) on public.memberships to authenticated;
grant insert (team_id, role, for_user_id, expires_at), delete on public.invites to authenticated;
grant insert (team_id, month, deadline, status) on public.planning_months to authenticated;
grant update (deadline, status) on public.planning_months to authenticated;
grant insert (team_id, planning_month_id, date, hours), delete on public.day_needs to authenticated;
grant update (hours) on public.day_needs to authenticated;
grant insert (team_id, planning_month_id, assistant_id, date, size, note, status, decision_comment)
  on public.offers to authenticated;
grant update (size, note, status, decision_comment) on public.offers to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.berlin_today(),
  public.is_team_member(uuid),
  public.is_team_manager(uuid),
  public.is_team_assistant(uuid),
  public.shares_team_with(uuid),
  public.open_planning_month(uuid, date),
  public.my_shifts_in_other_teams(uuid, date, date),
  public.create_swap_request(uuid, uuid, public.swap_reason, text),
  public.accept_swap_request(uuid),
  public.decline_swap_request(uuid),
  public.authorize_swap_request(uuid)
to authenticated;
-- The invite preview is shown before sign-in.
grant execute on function public.get_invite(text) to anon, authenticated;
-- Sign-in plumbing: server only.
grant execute on function
  public.redeem_invite(text, uuid),
  public.set_pin(uuid, text),
  public.check_pin(uuid, text)
to service_role;
