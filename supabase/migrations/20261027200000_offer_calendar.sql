-- Assistenz-Planer: what the assistant's offer calendar ("Angebote abgeben") needs.
--
-- * Next month's planning opens on its own: any member of a team can open the
--   current or the next month, so the calendar never waits for a manager.
--   Managers keep open_planning_month for any month.
-- * Assistants see how many hours each day still needs, without seeing who
--   offered or was approved before the schedule is published.

-- Opens the current or next month (Europe/Berlin) for offers, idempotent.
-- Any active member may call it; the deadline is the team's default.
create function public.open_offer_month(p_team_id uuid, p_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_this_month date := date_trunc('month', public.berlin_today())::date;
  v_deadline_day smallint;
  v_id uuid;
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'Keine Berechtigung für dieses Team.' using errcode = 'insufficient_privilege';
  end if;
  if v_month not in (v_this_month, (v_this_month + interval '1 month')::date) then
    raise exception 'Nur der laufende und der nächste Monat lassen sich öffnen.'
      using errcode = 'check_violation';
  end if;

  select default_deadline_day into v_deadline_day from public.teams where id = p_team_id;

  insert into public.planning_months (team_id, month, deadline)
  values (p_team_id, v_month, (v_month - interval '1 month')::date + (v_deadline_day - 1))
  on conflict (team_id, month) do nothing;

  select id into v_id from public.planning_months where team_id = p_team_id and month = v_month;
  return v_id;
end;
$$;

-- Every day of a planning month with the hours it needs (null while not set)
-- and the hours approved so far, summed over all assistants. Members only.
-- Open hours = needed - approved.
create function public.month_day_summary(p_planning_month_id uuid)
returns table (date date, hours_needed numeric, hours_approved numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month public.planning_months;
begin
  select * into v_month from public.planning_months where id = p_planning_month_id;
  if not found or not public.is_team_member(v_month.team_id) then
    raise exception 'Keine Berechtigung für diesen Monat.' using errcode = 'insufficient_privilege';
  end if;

  return query
  select d::date,
         n.hours,
         coalesce((
           select sum(o.hours) from public.offers o
           where o.planning_month_id = v_month.id and o.date = d::date and o.status = 'approved'
         ), 0)
  from generate_series(
    v_month.month, (v_month.month + interval '1 month' - interval '1 day')::date, interval '1 day'
  ) d
  left join public.day_needs n on n.planning_month_id = v_month.id and n.date = d::date
  order by 1;
end;
$$;

revoke execute on function
  public.open_offer_month(uuid, date),
  public.month_day_summary(uuid)
from public, anon;
grant execute on function
  public.open_offer_month(uuid, date),
  public.month_day_summary(uuid)
to authenticated;
