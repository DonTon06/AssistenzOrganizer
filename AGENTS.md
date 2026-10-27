<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes

- UI text is German and uses gender-inclusive forms with an asterisk (Arbeitgeber*in, Assistent*in).
- Read `README.md` for the data model and sign-in flow before changing either.
- Schema changes go in a new file in `supabase/migrations`; then run `npm run db:types` and
  extend `db-tests/access_rules_test.sql`, and check with `npm run test:db`.
- Row-level security is the real access control. Use the admin client (`lib/supabase/admin.ts`)
  only for sign-in plumbing.
