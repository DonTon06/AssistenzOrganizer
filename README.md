# Assistenz-Planer

Monthly shift planning for personal assistance in the employer model (Arbeitgebermodell).
Assistants offer the days they can work next month, the person with a disability (or their
proxy) approves or declines, and everyone sees the published schedule on their phone.

German UI, mobile first, installable as a PWA. Next.js 16 on a Supabase backend in the EU
(Frankfurt).

## What is in here so far

- **App skeleton:** Next.js App Router, Tailwind CSS 4, German UI, web app manifest, icons,
  a service worker with an offline page. Layout and colours aim at WCAG 2.1 AA (rem-based
  text, 48px+ tap targets, visible focus, zoom allowed, skip link).
- **Sign-in without passwords or email:** the first sign-in is by invite link, after that a
  6-digit PIN with lockout. See [Sign-in](#sign-in).
- **Roles:** employer (Arbeitgeber\*in), proxy (Vertretung) and assistant (Assistent\*in),
  per team. An assistant can be in several teams.
- **Database schema** with row-level security for teams, members, invites, planning months,
  daily hour needs, offers and swap or sick requests, plus tests for the access rules.

The calendar, approval, schedule and swap screens are built on top of this separately.

## Data model

All tables are in [`supabase/migrations`](supabase/migrations). Every team-owned row carries
a `team_id`, and row-level security limits everyone to their own teams.

| Table | Purpose |
| --- | --- |
| `profiles` | Name, contact email and phone, notification settings. One per auth user. |
| `teams` | Name, employer, default deadline day (15). |
| `memberships` | Team, user, role (`employer` / `proxy` / `assistant`), active. One employer per team; assistants can be in several teams. |
| `invites` | Single-use links: employer invites (create a team), join invites (assistant or proxy) and access links (existing member, new device or forgotten PIN). Valid 14 days. |
| `planning_months` | One per team and month: deadline, status (`open` / `in_review` / `published`). |
| `day_needs` | Hours of assistance a day needs (0 to 24). Gap = needed minus approved hours. |
| `offers` | Assistant, date, size (1 / 0.5 / 0.25 day = 24 / 12 / 6 h, `hours` is derived), note, status, `is_late` ("verspätet"), decision. |
| `swap_requests` | Hand an approved shift to one colleague or to the whole team, for a swap or a sick day. A colleague accepts, a manager authorizes. |
| `private.pin_credentials` | bcrypt PIN hash and lockout state. Not reachable through the API. |

Rules worth knowing:

- Half and quarter days are amounts of time, not fixed slots. Two half days on one date can
  both be approved.
- Offers made after the deadline are still accepted until the planned month ends, and are
  flagged `is_late`.
- Assistants can change or withdraw an offer until it is decided. Only managers (employer or
  proxy) approve, decline, set day needs and publish.
- `my_shifts_in_other_teams()` returns an assistant's approved shifts in their other teams,
  for the clash warning on the offer screen.
- Swaps go through the functions `create_swap_request`, `accept_swap_request`,
  `decline_swap_request` and `authorize_swap_request`. Authorizing marks the original shift
  `handed_over` and gives the colleague an approved shift of the same size.

## Sign-in

1. **Employer:** the operator creates an employer invite (`npm run einladung -- arbeitgeber "Team name"`)
   and sends the link. The employer opens it, enters their name, picks a PIN, and the team is created.
2. **Assistants and proxies:** the employer or proxy taps "Assistent\*in einladen" or
   "Vertretung einladen" on the start screen and shares the link (WhatsApp, email).
   Opening it asks for a name and a PIN.
3. **Later:** the device remembers the account, so signing in only asks for the PIN.
   Five wrong PINs lock the account for 15 minutes, doubling with each further wrong try.
4. **New phone or forgotten PIN:** a manager creates an access link for the person (the
   settings screen will offer this; the database supports it already), or the operator runs
   `npm run einladung -- zugang <user-id>`, which also works for employers.

Under the hood each person has a Supabase auth account with a placeholder email that never
gets mail. The server checks the PIN in the database and then starts a Supabase session for
that account, so row-level security works as usual. This is why the server needs the secret
key.

## Connect a Supabase project

1. Create a project at [supabase.com](https://supabase.com) in region **Central EU (Frankfurt)**.
2. Copy `.env.example` to `.env.local` and fill in, from Project Settings → API Keys:
   - `NEXT_PUBLIC_SUPABASE_URL`: the project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the publishable key (the legacy anon key also works)
   - `SUPABASE_SECRET_KEY`: a secret key (the legacy service role key also works). Keep it private.
   - `NEXT_PUBLIC_SITE_URL`: where the app runs, e.g. `http://localhost:3000`. Used in invite links.
3. Apply the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   Alternatively paste the migration file into the SQL editor of the dashboard.
4. Optional: in Authentication → Rate Limits, raise "Token verifications" if many people sign
   in at once. All sign-ins come from the app server's address.
5. Create the first employer invite and open the printed link:
   ```bash
   npm run einladung -- arbeitgeber "Assistenz Erika"
   ```

Without the env vars the app starts and shows a short setup notice.

## Develop locally

Requirements: Node 22, and Docker for the local Supabase stack.

```bash
npm install
npm run db:start      # local Supabase (Postgres, Auth, REST) and applies the migrations
cp .env.example .env.local   # then paste the URL and keys that db:start printed
npm run dev
npm run einladung -- arbeitgeber "Test-Team"
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run db:reset` | Recreates the local database from the migrations. |
| `npm run db:types` | Regenerates `lib/database.types.ts` from the local database. Run after changing a migration. |
| `npm run test:db` | Applies the migrations to a fresh Postgres database and checks the access rules. Needs `psql` and `DATABASE_URL` pointing at a server where you can create databases (the local Supabase one is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`). |
| `npm run lint`, `npm run typecheck`, `npm run build` | The usual checks. |

## Deploy

Vercel (choose the Frankfurt region, `fra1`) or any Node host with an EU region. Set the four
environment variables before the first build, because the `NEXT_PUBLIC_` ones are built into
the app.

## Project layout

```
app/                    routes (German paths: /anmelden, /einladung/[token])
  manifest.ts           PWA manifest
components/             shared UI (buttons, fields, PIN keypad, header)
lib/supabase/           Supabase clients for server, browser, proxy and admin use
lib/pin-auth.ts         invite and PIN sign-in
lib/auth.ts             current user, memberships, role checks
lib/roles.ts            German labels and offer sizes
lib/database.types.ts   generated types for the schema
proxy.ts                refreshes the session, sends signed-out visitors to /anmelden
public/sw.js            service worker
supabase/migrations/    database schema
db-tests/               access rule tests on plain Postgres
scripts/invite.mjs      operator tool for employer invites and access links
```
