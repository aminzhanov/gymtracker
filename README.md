# LiftLog · train together

A working React + TypeScript workout app, styled after the supplied LiftLog designs. Open directly into the training dashboard. Kilograms for lifting, with optional monthly percentage growth charts. Desktop sidebar and mobile bottom navigation.

**Status:** the complete frontend works in browser-local demo mode. Secure Supabase persistence, normalized database tables, Coach/Athlete permissions and invitations are implemented. Real accounts require the Supabase setup below. The repository includes GitHub Pages deployment; the repository owner must enable Pages. A passing local build is not proof of a live deployment or a tested email flow.

## Try it locally

Use Node 24 (also used by CI).

```bash
npm ci
npm run dev
```

Open the URL Vite prints. No database keys are needed for demo mode. Start empty, or go to **Settings → Load demo data** to explore eight weeks of workouts, alternating A/B volume, progression, records, bodyweight and future sessions. Demo data uses the current date. The sample profiles are explicitly simulated, each with separate browser storage. These are not real accounts.

## Included

- Dashboard with today's editable sets, completed sets and volume this week, prior-week change, all-time counts, upcoming/recent sessions, and new record events this calendar month.
- Training with collapsed exercise summaries (sets, reps, weights and completion); tap to edit, then save to collapse. Editable sessions, date moves, icons, difficulty, notes, custom exercises, add/remove sets, one weight/reps field, ±2.5 kg and ±1 rep controls, and last completed performance.
- Session templates with preserved A/B designation and fresh completion state when used.
- Warm-up and cool-down duration, notes and completion. Recovery minutes are separate from lifting volume, e1RM and PRs.
- Monday-first month calendar and seven-day agenda (the default on phones), both with exercise-name previews. Upcoming dashboard cards also list planned exercises. Click a date/session; drag sessions on desktop or use Move to date in the editor.
- Analytics with session/week/month volume charts and tables, configurable weekly spike threshold, A/B filters and average calendar-week comparison/history, connected simultaneous exercise comparisons in kilograms or percentage growth from each exercise’s first completed daily best in a selected month, five most frequent exercise records by default, bodyweight and 7-calendar-day moving averages.
- Per-athlete optional A/B split in Settings; disabling it hides program-week badges, filters and comparisons while keeping existing workout history.
- JSON backup validation and full selected-athlete import/export. Replace/clear actions require confirmation. Exercise deletion preserves logged history.
- Real coach profile selector, People summaries, session/template management, invitation and deactivation. Athletes only receive their own account view.
- Database-level authorization, transactional saves, normalized relational tables, stale-edit detection, and an unsaved-data warning. Training data is not written to GitHub.

Only strength sets with `done = true` count toward lifting analytics, including sets completed in a session whose status is still planned. Completing a session marks every remaining set and recovery item done using current values. Unchecking a set reopens its session. Epley: `weight * (1 + reps / 30)`. First-ever e1RM records count as records; subsequent strictly higher records are counted at most once per exercise per session. Bodyweight movements with 0 kg can be logged, but produce no weight-based record. A/B comparison averages calendar-week totals with completed lifting volume of that program; in-progress weeks are included. Missing percentage baselines display an empty value.

## Publish on the free GitHub domain

1. In this repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Test and deploy LiftLog → Run workflow**, select `main`, then run it. Future main-branch pushes test, build and deploy automatically.
4. Use the URL returned by the deployment. For this repository the expected address is `https://aminzhanov.github.io/gymtracker/` after successful deployment.

Without Supabase variables, the deployed app is a local demo. Your friends cannot share real account data until you connect the backend. The repository is public; do not commit any private training backups or administrative keys.

## Connect real accounts

### 1. Create the database

1. Create a Supabase project at https://supabase.com/dashboard.
2. Before creating app users, open **SQL Editor** and run [`supabase/migrations/001_liftlog.sql`](supabase/migrations/001_liftlog.sql) once, then [`supabase/migrations/002_program_preferences.sql`](supabase/migrations/002_program_preferences.sql). These create the tables, policies, functions, new-user trigger and program preference.
3. This migration is intended for a new project. If you already have Auth users, their profiles/settings need to be backfilled by an administrator before they can use the app; do not rerun the migration on an existing schema.

### Upgrade an existing LiftLog database

Run only [`supabase/migrations/002_program_preferences.sql`](supabase/migrations/002_program_preferences.sql) in **SQL Editor**, then refresh LiftLog. It adds the per-athlete A/B preference and updates the load/save RPCs atomically, retaining accounts, relationships, workouts and revisions. It is safe to rerun. Existing accounts default to A/B enabled. The frontend continues to use the old database until this is applied, with the new preference disabled instead of silently failing to save it.

### 2. Create your Coach account

1. In Supabase **Authentication → Users → Add user → Create user**, create your own email/password account and confirm it. Use a strong password.
2. Copy your Auth user UUID.
3. In SQL Editor, run this with your actual UUID:

```sql
update public.profiles
set role = 'coach', name = 'Aleksei'
where id = 'YOUR_AUTH_USER_UUID';

update public.user_settings
set display_name = 'Aleksei'
where owner_user_id = 'YOUR_AUTH_USER_UUID';
```

4. In Auth settings, disable public sign-ups for this invitation-only app. The client has no sign-up screen. Do not disable the email/password provider.

### 3. Configure the frontend connection

From the project's API settings, copy the project URL and **public anon/publishable key**. The variable name supports either public key style. Never use a secret or service-role key here.

For GitHub Pages, add two **repository variables** in **Settings → Secrets and variables → Actions → Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then run the deployment workflow again. These variables are embedded in the browser build. Permissions are enforced by the database, not by keeping the public key secret.

For local development, copy `.env.example` to `.env.local`, fill these same values, and restart Vite. `.env.local` is ignored by Git.

### 4. Configure login redirects and email

In Supabase Auth URL configuration, set **Site URL** to the actual deployed app URL. Add allowed redirect URLs for that URL and its `?welcome=1` variant, e.g.:

- `https://aminzhanov.github.io/gymtracker/`
- `https://aminzhanov.github.io/gymtracker/?welcome=1`

For local testing also allow `http://localhost:5173/` and its welcome variant.

**For invitations and password resets to your friends, configure custom SMTP in Supabase Auth.** Supabase's built-in mail server only sends to pre-authorized project-team addresses; it is not suitable for inviting arbitrary friends. Use the SMTP credentials of an email provider you control. See https://supabase.com/docs/guides/auth/auth-smtp.

### 5. Deploy the secure invitation function

Install the Supabase CLI following https://supabase.com/docs/guides/cli/getting-started, then run from this repository:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set SITE_URL=https://aminzhanov.github.io/gymtracker/
supabase functions deploy invite-athlete
```

The function's Supabase URL and service-role key are provided by the Supabase function environment; no administrative key belongs in the frontend. The function verifies the caller's token with `auth.getUser()` and checks an active Coach role before reserving or sending an invitation. A private reservation token binds the new account to its coach inside the Auth user-creation transaction. Existing accounts are not reassigned. Database functions are revoked from public access and granted only to the appropriate roles.

`verify_jwt = false` in `supabase/config.toml` delegates token verification to the function, which explicitly validates it; it does not make invitation creation public.

### 6. Invite and test

1. Sign in with your Coach account. Open **People → Invite athlete**.
2. Enter your friend's name and email. This action sends the invitation only when you submit it.
3. They follow the email link, set a password and receive their own empty training account.
4. Switch to that athlete and create a session; they can edit the same weight/reps fields and complete sets.
5. Test with two separate athlete accounts: neither may see or change the other's training data. Use separate browser profiles/private windows for this check.
6. Deactivation blocks that athlete's training access, preserving their data and the coach's ability to view it.

An expired invitation can be resent by the project administrator in Supabase Auth. If an email error leaves a partially created account, inspect it there before retrying; the app never deletes an Auth account automatically. Existing-account reassignment requires administrator review.

## Cloud saves and backups

Cloud edits are queued and saved transactionally. Each selected athlete has a database revision. If another device or the coach changed that athlete's data, a stale save stops rather than silently overwriting newer data. Export unsaved local edits first, then reload saved data and reconcile. The app warns before navigating away while edits are pending or unsaved. It is online-first: offline cloud editing is not a supported sync workflow.

Import/clear/demo affects only the selected athlete's training dataset. Account roles, credentials, invitations and coach links are administered separately and are not part of a training JSON backup.

## Validation

```bash
npm test
npm run build
```

Tests cover completed-set analytics, session completion, separate recovery metrics, new-record events, A/B averages, Monday buckets, date-based bodyweight averages, fresh template identities, backup validation and week alternation.

The database integration tests execute the actual migration in embedded PostgreSQL (PGlite), using three users and role switching. They verify own-data writes, foreign-owner denial, table-level RLS, blocked role promotion/direct mutations, malformed-backup rollback, stale/null-revision rejection, coach assignment access, server-enforced completion, and deactivation. Auth email delivery and the Edge Function require testing against your configured Supabase project; PGlite does not emulate those services.

The responsive update has model and PostgreSQL integration coverage for sparse exercise histories, monthly growth, legacy backups and the program preference upgrade. A local browser preview could not run in this execution environment; verify the layout on your phone and desktop.

## Other hosting

The output is a static Vite build in `dist/` with relative asset URLs and no client routing requirement. Cloudflare Pages can use build command `npm run build`, output directory `dist`, and the same two public environment variables. Configure the actual host URL in Supabase redirects and the function's `SITE_URL`.

Official references: [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth](https://supabase.com/docs/guides/auth), [invitations](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).
