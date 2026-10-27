-- Checks the access rules of the schema. Run with `npm run test:db`.
-- Each check raises an exception on failure, so the run stops at the first one.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

create schema test_helpers;
grant usage on schema test_helpers to authenticated, anon, service_role;

-- Runs p_sql and fails unless it raises an error.
create function test_helpers.expect_error(p_label text, p_sql text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FAILED (expected an error): %', p_label;
end;
$$;

create function test_helpers.expect(p_label text, p_ok boolean) returns void
language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'FAILED: %', p_label;
  end if;
end;
$$;

-- Named ids shared between the steps below.
create table test_helpers.ids (key text primary key, id uuid);
create function test_helpers.id(p_key text) returns uuid
language sql stable as $$ select id from test_helpers.ids where key = p_key $$;

create function test_helpers.token(p_key text) returns text
language sql stable security definer as $$
  select token from public.invites where id = test_helpers.id(p_key)
$$;

grant all on test_helpers.ids to authenticated, anon, service_role;
grant execute on all functions in schema test_helpers to authenticated, anon, service_role;

-- People. Erika and Zoe are employers, Paula is Erika's proxy, Ali and Bea
-- assist Erika (Ali also assists Zoe), Carl belongs to no team.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000e', 'erika@konto.invalid', '{"name": "Erika"}'),
  ('00000000-0000-0000-0000-00000000000f', 'zoe@konto.invalid', '{"name": "Zoe"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'paula@konto.invalid', '{"name": "Paula"}'),
  ('00000000-0000-0000-0000-00000000000a', 'ali@konto.invalid', '{"name": "Ali"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bea@konto.invalid', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'carl@konto.invalid', '{}');

insert into test_helpers.ids values
  ('erika', '00000000-0000-0000-0000-00000000000e'),
  ('zoe', '00000000-0000-0000-0000-00000000000f'),
  ('paula', '00000000-0000-0000-0000-0000000000a1'),
  ('ali', '00000000-0000-0000-0000-00000000000a'),
  ('bea', '00000000-0000-0000-0000-00000000000b'),
  ('carl', '00000000-0000-0000-0000-00000000000c');

select test_helpers.expect('profiles are created for new users',
  (select count(*) from public.profiles) = 6);
select test_helpers.expect('profile name comes from sign-up metadata',
  (select name from public.profiles where id = test_helpers.id('erika')) = 'Erika');

-- ----- The operator invites two employers ---------------------------------
with i as (insert into public.invites (role, team_name) values ('employer', 'Team Erika') returning id)
insert into test_helpers.ids select 'inv_erika', id from i;
with i as (insert into public.invites (role, team_name) values ('employer', 'Team Zoe') returning id)
insert into test_helpers.ids select 'inv_zoe', id from i;

set role anon;
select test_helpers.expect('invite preview works before sign-in',
  (select valid and role = 'employer' and team_name = 'Team Erika'
   from public.get_invite(test_helpers.token('inv_erika'))));
select test_helpers.expect_error('anon cannot redeem invites',
  format('select public.redeem_invite(%L, %L)', test_helpers.token('inv_erika'), test_helpers.id('carl')));

set role service_role;
insert into test_helpers.ids
select 'team', public.redeem_invite(test_helpers.token('inv_erika'), test_helpers.id('erika'));
insert into test_helpers.ids
select 'team_zoe', public.redeem_invite(test_helpers.token('inv_zoe'), test_helpers.id('zoe'));
select test_helpers.expect_error('an invite works once',
  format('select public.redeem_invite(%L, %L)', test_helpers.token('inv_erika'), test_helpers.id('carl')));
reset role;

-- ----- Erika invites a proxy and two assistants -----------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';

select test_helpers.expect('Erika manages her team', public.is_team_manager(test_helpers.id('team')));
select test_helpers.expect('Erika does not manage Zoe''s team', not public.is_team_manager(test_helpers.id('team_zoe')));

with i as (insert into public.invites (team_id, role) values (test_helpers.id('team'), 'proxy') returning id)
insert into test_helpers.ids select 'inv_paula', id from i;
with i as (insert into public.invites (team_id) values (test_helpers.id('team')) returning id)
insert into test_helpers.ids select 'inv_ali', id from i;
with i as (insert into public.invites (team_id) values (test_helpers.id('team')) returning id)
insert into test_helpers.ids select 'inv_bea', id from i;
select test_helpers.expect_error('employers cannot invite more employers', format(
  'insert into public.invites (team_id, role) values (%L, %L)', test_helpers.id('team'), 'employer'));

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
with i as (insert into public.invites (team_id) values (test_helpers.id('team_zoe')) returning id)
insert into test_helpers.ids select 'inv_ali_zoe', id from i;
select test_helpers.expect_error('Zoe cannot invite into Erika''s team', format(
  'insert into public.invites (team_id) values (%L)', test_helpers.id('team')));

reset role;
set role service_role;
select public.redeem_invite(test_helpers.token('inv_paula'), test_helpers.id('paula'));
select public.redeem_invite(test_helpers.token('inv_ali'), test_helpers.id('ali'));
select public.redeem_invite(test_helpers.token('inv_bea'), test_helpers.id('bea'));
-- Assistants can work for several employers.
select public.redeem_invite(test_helpers.token('inv_ali_zoe'), test_helpers.id('ali'));
reset role;

-- ----- Carl is no member: he sees nothing and cannot act --------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';

select test_helpers.expect('outsider sees no teams', (select count(*) from public.teams) = 0);
select test_helpers.expect('outsider sees no months', (select count(*) from public.planning_months) = 0);
select test_helpers.expect('outsider sees no invites', (select count(*) from public.invites) = 0);
select test_helpers.expect('outsider sees only own profile', (select count(*) from public.profiles) = 1);
select test_helpers.expect_error('outsider cannot open a month',
  format('select public.open_planning_month(%L, %L)', test_helpers.id('team'), '2100-01-01'));
select test_helpers.expect_error('signed-in users cannot redeem invites themselves',
  format('select public.redeem_invite(%L, %L)', 'x', test_helpers.id('carl')));
select test_helpers.expect_error('signed-in users cannot check PINs',
  format('select * from public.check_pin(%L, %L)', test_helpers.id('erika'), '123456'));
select test_helpers.expect_error('signed-in users cannot set PINs',
  format('select public.set_pin(%L, %L)', test_helpers.id('erika'), '123456'));
select test_helpers.expect_error('PIN table is not reachable',
  'select * from private.pin_credentials');

-- ----- Paula, the proxy, plans the month ------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

select test_helpers.expect('proxy manages the team', public.is_team_manager(test_helpers.id('team')));

-- December 2099 is open for offers (deadline 15 November 2099). February 2000
-- is over. The current month is past its deadline, so offers there are late.
insert into test_helpers.ids select 'open_month', public.open_planning_month(test_helpers.id('team'), '2099-12-01');
select test_helpers.expect('opening a month twice returns the same month',
  public.open_planning_month(test_helpers.id('team'), '2099-12-10') = test_helpers.id('open_month'));
select test_helpers.expect('deadline defaults to the 15th of the month before',
  (select deadline from public.planning_months where id = test_helpers.id('open_month')) = '2099-11-15');
with m as (
  insert into public.planning_months (team_id, month, deadline)
  values (test_helpers.id('team'), '2000-02-01', '2000-01-15') returning id
)
insert into test_helpers.ids select 'past_month', id from m;
with m as (
  insert into public.planning_months (team_id, month, deadline)
  select test_helpers.id('team'), date_trunc('month', public.berlin_today())::date,
         date_trunc('month', public.berlin_today())::date - 1
  returning id
)
insert into test_helpers.ids select 'current_month', id from m;

insert into public.day_needs (team_id, planning_month_id, date, hours)
values (test_helpers.id('team'), test_helpers.id('open_month'), '2099-12-03', 24);
select test_helpers.expect_error('needs are at most 24 hours', format(
  'insert into public.day_needs (team_id, planning_month_id, date, hours) values (%L, %L, %L, 25)',
  test_helpers.id('team'), test_helpers.id('open_month'), '2099-12-04'));
select test_helpers.expect_error('need dates must be in the month', format(
  'insert into public.day_needs (team_id, planning_month_id, date, hours) values (%L, %L, %L, 8)',
  test_helpers.id('team'), test_helpers.id('open_month'), '2100-01-04'));

select test_helpers.expect_error('proxy cannot make an access link for the employer', format(
  'insert into public.invites (team_id, for_user_id) values (%L, %L)',
  test_helpers.id('team'), test_helpers.id('erika')));
with i as (
  insert into public.invites (team_id, for_user_id) values (test_helpers.id('team'), test_helpers.id('ali'))
  returning id
)
insert into test_helpers.ids select 'access_ali', id from i;

-- ----- Assistants make offers ------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

select test_helpers.expect('assistant sees both teams', (select count(*) from public.teams) = 2);
select test_helpers.expect('assistant cannot see invites', (select count(*) from public.invites) = 0);
select test_helpers.expect('assistant sees day needs', (select count(*) from public.day_needs) = 1);
select test_helpers.expect_error('assistant cannot set day needs', format(
  'insert into public.day_needs (team_id, planning_month_id, date, hours) values (%L, %L, %L, 8)',
  test_helpers.id('team'), test_helpers.id('open_month'), '2099-12-05'));

insert into public.offers (team_id, planning_month_id, assistant_id, date, size, note)
values (test_helpers.id('team'), test_helpers.id('open_month'), test_helpers.id('ali'), '2099-12-03', 0.5, 'ab 14 Uhr');
select test_helpers.expect('half a day is 12 hours',
  (select hours from public.offers where date = '2099-12-03') = 12);
select test_helpers.expect('offers before the deadline are not late',
  (select not is_late from public.offers where date = '2099-12-03'));

insert into public.offers (team_id, planning_month_id, assistant_id, date, size)
select test_helpers.id('team'), test_helpers.id('current_month'), test_helpers.id('ali'), public.berlin_today(), 0.25;
select test_helpers.expect('offers after the deadline are marked late',
  (select is_late from public.offers where planning_month_id = test_helpers.id('current_month')));

select test_helpers.expect_error('no offers once the month is over', format(
  'insert into public.offers (team_id, planning_month_id, assistant_id, date, size) values (%L, %L, %L, %L, 1)',
  test_helpers.id('team'), test_helpers.id('past_month'), test_helpers.id('ali'), '2000-02-20'));
select test_helpers.expect_error('assistant cannot approve on insert', format(
  'insert into public.offers (team_id, planning_month_id, assistant_id, date, size, status) values (%L, %L, %L, %L, 1, %L)',
  test_helpers.id('team'), test_helpers.id('open_month'), test_helpers.id('ali'), '2099-12-04', 'approved'));
select test_helpers.expect_error('assistant cannot offer for someone else', format(
  'insert into public.offers (team_id, planning_month_id, assistant_id, date, size) values (%L, %L, %L, %L, 1)',
  test_helpers.id('team'), test_helpers.id('open_month'), test_helpers.id('bea'), '2099-12-04'));
select test_helpers.expect_error('sizes other than 1, 0.5, 0.25 are rejected', format(
  'insert into public.offers (team_id, planning_month_id, assistant_id, date, size) values (%L, %L, %L, %L, 0.75)',
  test_helpers.id('team'), test_helpers.id('open_month'), test_helpers.id('ali'), '2099-12-05'));
select test_helpers.expect_error('date must be inside the planning month', format(
  'insert into public.offers (team_id, planning_month_id, assistant_id, date, size) values (%L, %L, %L, %L, 1)',
  test_helpers.id('team'), test_helpers.id('open_month'), test_helpers.id('ali'), '2100-01-05'));
select test_helpers.expect_error('one live offer per assistant and day', format(
  'insert into public.offers (team_id, planning_month_id, assistant_id, date, size) values (%L, %L, %L, %L, 1)',
  test_helpers.id('team'), test_helpers.id('open_month'), test_helpers.id('ali'), '2099-12-03'));
select test_helpers.expect_error('assistant cannot approve own offer',
  $$update public.offers set status = 'approved' where date = '2099-12-03'$$);
update public.planning_months set deadline = '2099-11-30' where id = test_helpers.id('open_month');
select test_helpers.expect('assistant cannot move the deadline',
  (select deadline from public.planning_months where id = test_helpers.id('open_month')) = '2099-11-15');

-- Withdraw and re-offer the same day.
update public.offers set status = 'withdrawn' where date = '2099-12-03';
insert into public.offers (team_id, planning_month_id, assistant_id, date, size)
values (test_helpers.id('team'), test_helpers.id('open_month'), test_helpers.id('ali'), '2099-12-03', 1);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.offers (team_id, planning_month_id, assistant_id, date, size)
values (test_helpers.id('team'), test_helpers.id('open_month'), test_helpers.id('bea'), '2099-12-03', 0.5);
select test_helpers.expect('before publishing, assistants see only their own offers',
  (select count(*) from public.offers) = 1);

-- ----- Paula decides and publishes -------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

select test_helpers.expect('manager sees all offers', (select count(*) from public.offers) = 4);
-- Half and quarter days are amounts of time, so two offers on one day can both be approved.
update public.offers set status = 'approved', decision_comment = 'Danke!'
where date = '2099-12-03' and status = 'submitted';
select test_helpers.expect('decision is stamped with the proxy',
  (select bool_and(decided_by = test_helpers.id('paula') and decided_at is not null)
   from public.offers where status = 'approved'));
select test_helpers.expect('gap per day = need - approved hours',
  (select n.hours - sum(o.hours) from public.day_needs n
   join public.offers o on o.date = n.date and o.status = 'approved'
   where n.date = '2099-12-03' group by n.hours) = -12);
select test_helpers.expect_error('managers cannot edit an assistant note',
  $$update public.offers set note = 'x' where status = 'approved'$$);
select test_helpers.expect_error('managers cannot hand over shifts directly',
  $$update public.offers set status = 'handed_over' where status = 'approved'$$);
update public.planning_months set status = 'published' where id = test_helpers.id('open_month');
select test_helpers.expect('published_at is stamped',
  (select published_at is not null from public.planning_months where id = test_helpers.id('open_month')));
select test_helpers.expect_error('managers cannot hand the team to someone else',
  $$update public.teams set employer_id = '00000000-0000-0000-0000-00000000000a'$$);

-- ----- After publishing ------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select test_helpers.expect('after publishing, assistants see the approved schedule',
  (select count(*) from public.offers where status = 'approved') = 2);
select test_helpers.expect('withdrawn offers of others stay hidden',
  (select count(*) from public.offers where status = 'withdrawn') = 0);
select test_helpers.expect_error('decided offers are locked for assistants',
  $$update public.offers set size = 1 where assistant_id = '00000000-0000-0000-0000-00000000000b'$$);

-- Zoe approves a shift for Ali on the same day, so Ali sees a clash warning.
reset role;
reset request.jwt.claim.sub;
insert into public.planning_months (team_id, month, deadline, status)
values (test_helpers.id('team_zoe'), '2099-12-01', '2099-11-15', 'published');
insert into public.offers (team_id, planning_month_id, assistant_id, date, size, status)
select test_helpers.id('team_zoe'), id, test_helpers.id('ali'), '2099-12-03', 0.25, 'approved'
from public.planning_months where team_id = test_helpers.id('team_zoe');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select test_helpers.expect('assistant sees shifts in other teams for clash warnings',
  (select count(*) = 1 and min(team_name) = 'Team Zoe' and sum(hours) = 6
   from public.my_shifts_in_other_teams(test_helpers.id('team'), '2099-12-01', '2099-12-31')));

-- ----- Swaps -----------------------------------------------------------------
-- Ali asks Bea to take over his shift on 3 December.
insert into test_helpers.ids
select 'swap', public.create_swap_request(
  (select id from public.offers where team_id = test_helpers.id('team') and assistant_id = test_helpers.id('ali')
     and date = '2099-12-03' and status = 'approved'),
  test_helpers.id('bea'), 'swap', 'Arzttermin');
select test_helpers.expect_error('only one pending request per shift', format(
  'select public.create_swap_request(%L)',
  (select offer_id from public.swap_requests where id = test_helpers.id('swap'))));
select test_helpers.expect_error('requester cannot accept own request',
  format('select public.accept_swap_request(%L)', test_helpers.id('swap')));
select test_helpers.expect_error('assistants cannot authorize',
  format('select public.authorize_swap_request(%L)', test_helpers.id('swap')));

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select test_helpers.expect_error('Bea cannot swap a shift that is not hers', format(
  'select public.create_swap_request(%L)',
  (select offer_id from public.swap_requests where id = test_helpers.id('swap'))));
select public.accept_swap_request(test_helpers.id('swap'));

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.authorize_swap_request(test_helpers.id('swap'));
select test_helpers.expect('original shift is handed over',
  (select status = 'handed_over' from public.offers
   where id = (select offer_id from public.swap_requests where id = test_helpers.id('swap'))));
select test_helpers.expect('Bea now has an extra approved shift that day',
  (select count(*) = 2 and sum(hours) = 36 from public.offers
   where assistant_id = test_helpers.id('bea') and date = '2099-12-03' and status = 'approved'));
select test_helpers.expect('swap is authorized by the proxy',
  (select status = 'authorized' and decided_by = test_helpers.id('paula')
   from public.swap_requests where id = test_helpers.id('swap')));

-- Bea reports sick for her original shift; nobody takes over, Erika authorizes anyway.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into test_helpers.ids
select 'sick', public.create_swap_request(
  (select id from public.offers where assistant_id = test_helpers.id('bea') and source_swap_id is null
     and status = 'approved'),
  null, 'sick', null);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select test_helpers.expect('open requests are visible to the team',
  (select count(*) from public.swap_requests where id = test_helpers.id('sick')) = 1);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select public.authorize_swap_request(test_helpers.id('sick'));
select test_helpers.expect('sick shift is handed over without replacement',
  (select count(*) from public.offers where source_swap_id = test_helpers.id('sick')) = 0);

-- ----- Access links and deactivation -----------------------------------------
reset role;
set role service_role;
select test_helpers.expect_error('an access link only works for its person', format(
  'select public.redeem_invite(%L, %L)', test_helpers.token('access_ali'), test_helpers.id('bea')));
select test_helpers.expect('an access link signs its person back in',
  public.redeem_invite(test_helpers.token('access_ali'), test_helpers.id('ali')) = test_helpers.id('team'));
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
update public.memberships set active = false where user_id = test_helpers.id('bea');
update public.memberships set active = false where role = 'employer';
select test_helpers.expect('the employer cannot be deactivated',
  (select active from public.memberships where user_id = test_helpers.id('erika')));
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select test_helpers.expect('deactivated assistant sees no team', (select count(*) from public.teams) = 0);
select test_helpers.expect('deactivated assistant sees no offers', (select count(*) from public.offers) = 0);

-- ----- Offer calendar ----------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into test_helpers.ids select 'next_month', public.open_offer_month(
  test_helpers.id('team'), (date_trunc('month', public.berlin_today()) + interval '1 month')::date);
select test_helpers.expect('assistants open next month with the team''s deadline',
  (select deadline = date_trunc('month', public.berlin_today())::date + 14 and status = 'open'
   from public.planning_months where id = test_helpers.id('next_month')));
select test_helpers.expect('opening next month twice returns the same month',
  public.open_offer_month(test_helpers.id('team'),
    (date_trunc('month', public.berlin_today()) + interval '1 month' + interval '9 days')::date)
  = test_helpers.id('next_month'));
select test_helpers.expect('opening the current month returns the existing one',
  public.open_offer_month(test_helpers.id('team'), public.berlin_today()) = test_helpers.id('current_month'));
select test_helpers.expect_error('assistants cannot open months further ahead', format(
  'select public.open_offer_month(%L, %L)', test_helpers.id('team'), '2099-01-01'));
select test_helpers.expect('day summary lists every day of the month',
  (select count(*) from public.month_day_summary(test_helpers.id('open_month'))) = 31);
select test_helpers.expect('day summary has needs and approved hours of the whole team',
  (select hours_needed = 24 and hours_approved = 24
   from public.month_day_summary(test_helpers.id('open_month')) where date = '2099-12-03'));
select test_helpers.expect('days without a need show none',
  (select hours_needed is null and hours_approved = 0
   from public.month_day_summary(test_helpers.id('open_month')) where date = '2099-12-04'));

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select test_helpers.expect_error('outsiders cannot open months for offers', format(
  'select public.open_offer_month(%L, %L)', test_helpers.id('team'), public.berlin_today()));
select test_helpers.expect_error('outsiders cannot read the day summary', format(
  'select * from public.month_day_summary(%L)', test_helpers.id('open_month')));

-- ----- PINs ------------------------------------------------------------------
reset role;
reset request.jwt.claim.sub;
set role service_role;
select test_helpers.expect('no PIN yet',
  (select result from public.check_pin(test_helpers.id('ali'), '123456')) = 'no_pin');
select test_helpers.expect_error('a PIN has 6 digits',
  format('select public.set_pin(%L, %L)', test_helpers.id('ali'), '12345'));
select public.set_pin(test_helpers.id('ali'), '482915');
select test_helpers.expect('right PIN',
  (select result from public.check_pin(test_helpers.id('ali'), '482915')) = 'ok');
select test_helpers.expect('wrong PIN',
  (select result from public.check_pin(test_helpers.id('ali'), '000000')) = 'wrong');
select public.check_pin(test_helpers.id('ali'), '000000') from generate_series(1, 3);
select test_helpers.expect('fifth wrong PIN locks the account',
  (select result = 'locked' and locked_until > now() + interval '14 minutes'
   from public.check_pin(test_helpers.id('ali'), '000000')));
select test_helpers.expect('a locked account rejects even the right PIN',
  (select result from public.check_pin(test_helpers.id('ali'), '482915')) = 'locked');
select public.set_pin(test_helpers.id('ali'), '482915');
select test_helpers.expect('setting a new PIN (via an access link) unlocks',
  (select result from public.check_pin(test_helpers.id('ali'), '482915')) = 'ok');

-- ----- Anonymous visitors see nothing -----------------------------------------
set role anon;
select test_helpers.expect_error('anon cannot read teams', 'select * from public.teams');
select test_helpers.expect_error('anon cannot check PINs',
  format('select * from public.check_pin(%L, %L)', test_helpers.id('ali'), '482915'));

reset role;
\echo 'All access rule checks passed.'
