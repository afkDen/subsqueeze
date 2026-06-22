# Build Guide
**Project:** SubSqueeze
**Companion docs:** `01_PID.md`, `02_Design_Doc.md`, `03_Progress.md`, `supabase_schema.sql`
**Document version:** 1.0
**Last updated:** 2026-06-22

This is the step-by-step "do this, then this" guide — prerequisites, Supabase
setup, environment variables, and the exact prompt to hand to **Antigravity 2.0**
to build the app. As of mid-2026, Antigravity 2.0 is Google's standalone
agent-orchestration desktop app (separate from the original Antigravity IDE) —
you describe the task and it plans, writes, runs, and verifies the work
autonomously, optionally with sub-agents. Treat the prompt in §5 as a single,
complete task description, not a back-and-forth chat.

---

## 1. Prerequisites

### Accounts (all have free tiers, sufficient for this project)
- [ ] **GitHub** account — version control + what Vercel/Antigravity deploy from
- [ ] **Supabase** account — [supabase.com](https://supabase.com)
- [ ] **Vercel** account — [vercel.com](https://vercel.com) (sign in with GitHub)
- [ ] **Antigravity 2.0** installed and signed in — [antigravity.google](https://antigravity.google)

### Local tooling
- [ ] **Node.js 20+** (`node -v` to check)
- [ ] **pnpm** (`npm install -g pnpm`) — or use npm if you prefer, just be
      consistent in the prompt below
- [ ] **Git** installed and configured (`git config --global user.name/email`)
- [ ] A code editor (VS Code or the Antigravity IDE both work fine — Antigravity
      2.0 the orchestrator can run alongside either)

### Have on hand before you start
- [ ] This whole `subsqueeze/` folder (all 4 docs + the SQL file) — Antigravity
      will need to read these, so keep them in the project root
- [ ] A short list of 2–3 test "people" (e.g., your own email + a second test
      email) so you can verify multi-user balances actually work

---

## 2. Create the Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New
   project**.
2. Name it `subsqueeze` (or anything), choose a region close to you, set a
   strong database password — **save that password somewhere**, you won't need
   it day-to-day but you'll want it if you ever connect directly via `psql`.
3. Wait for provisioning (~2 minutes).

## 3. Run the Schema

1. In the Supabase dashboard: **SQL Editor → New query**.
2. Paste the entire contents of `supabase_schema.sql`.
3. Click **Run**. You should see "Success. No rows returned."
4. Sanity check: **Table Editor** should now show `users`, `cohorts`,
   `user_cohorts`, `expenses`, `liability_fractions`, `settlement_log`.
5. **Authentication → Providers**: confirm "Email" is enabled (it is by
   default). For local dev, you can also disable "Confirm email" under
   **Authentication → Settings** temporarily so test sign-ups don't need inbox
   access — re-enable before going to production.

## 4. Get Your API Keys

In Supabase: **Project Settings → API**. You'll need:

| Value | Where it's used |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | **Server-only**, optional — skip unless you later add an admin script. Never expose this in client code. |

Create a `.env.local` file at the project root (Antigravity will create the
project itself — see §6 — but plan to drop this file in once the project
exists):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

`.env.local` is git-ignored by default in Next.js — keep it that way.

## 5. The Antigravity 2.0 Prompt

Open Antigravity 2.0, point it at an empty project folder (or let it create
one), make sure `01_PID.md`, `02_Design_Doc.md`, `03_Progress.md`, and
`supabase_schema.sql` are in that folder so the agent can read them directly,
and paste the prompt below as your task.

> **Tip:** Antigravity 2.0 works best with one complete, unambiguous task
> description up front rather than incremental chat turns — it plans and
> parallelizes from what you give it. The prompt below is written as that
> single task description. Don't shorten it.

````
I'm building a web app called SubSqueeze. Full context for this project is in
three files already in this project folder — read all of them before writing
any code:
- PID.md (project goals and scope)
- DesignDoc.md (architecture, schema, features, folder structure)
- supabase_schema.sql (the exact Postgres schema already created in my live
  Supabase project — do not modify table/column names, this is final)

TECH STACK (do not substitute):
- Next.js 15, App Router, TypeScript, all in a single Next.js project
- Tailwind CSS v4
- shadcn/ui (New York style) for all UI components — initialize it properly
  via the shadcn CLI, don't hand-roll component primitives
- Supabase as the only backend (Postgres + Auth + RLS) via @supabase/ssr —
  no separate custom API server
- React Hook Form + Zod for all forms and validation
- pnpm as the package manager
- Deploy target is Vercel (so use Vercel-compatible patterns: Server
  Components, Server Actions, no Node-only APIs that don't run on Vercel's
  edge/node runtime)

WHAT TO BUILD (MVP scope — do not add anything beyond this list):
1. Auth: email/password sign-up and login via Supabase Auth. On sign-up, a
   row in public.users is auto-created by the database trigger that's
   already in the schema — do NOT duplicate that insert in application code.
2. Route protection: middleware that refreshes the Supabase session and
   redirects unauthenticated users away from any authenticated route to
   /login.
3. Cohorts: create a cohort (name + description, creator becomes admin in
   user_cohorts), join a cohort via its invite_code, list my cohorts, view a
   single cohort's member list, leave a cohort.
4. Expenses: add an expense to a cohort with description, a category selector
   (exactly two options: "Subscription" and "General" — this is a constrained
   field backed by the expenses.category column, not a free-text tag), total
   amount, date, and a member picker (defaults to all cohort members). Support
   two split modes: Equal (divide evenly, assign any leftover rounding cents to
   the payer so the split always sums exactly to total_amount) and Custom
   (user enters each member's share manually; block submission unless the
   shares sum exactly to total_amount). On submit, create one row in
   expenses and one liability_fractions row per included member, in a
   single database transaction (use a Postgres function/RPC or a Server
   Action with proper error handling so partial writes can't happen).
   Support editing and deleting an expense I created.
5. Balances: compute each user's net balance per cohort (who they owe / who
   owes them, netting unsettled liability_fractions against
   settlement_log rows) and an aggregate balance across all their cohorts
   for a dashboard. Use the v_pairwise_balances view from the schema file
   if it fits, or write equivalent SQL — do not compute this by pulling all
   rows to the client and summing in JavaScript.
6. Settlements: a "Settle up" action that records a payment between two
   users (insert into settlement_log), pre-filled with the suggested
   amount from their current balance. Settlement records are IMMUTABLE —
   the database already enforces this with a trigger that blocks any UPDATE.
   The UI must therefore have NO edit or delete control on any settlement
   entry. If a user needs to correct a mistake, they record a new settlement
   in the other direction. Communicate this clearly to the user in the UI
   (e.g., a note near the confirmation: "Settlement records cannot be
   changed after submission."). Balances must reflect the new settlement
   immediately after submission.
7. Activity feed: a reverse-chronological list per cohort combining
   expenses and settlements.
8. All money fields are numeric/decimal end to end — never use
   JavaScript floating point for amount math; do currency math as strings
   or integers-of-cents where precision matters, and always verify split
   amounts sum exactly to the total before allowing submission.

DESIGN / UX requirements:
- Follow the design token system in DesignDoc.md section 10 (Visual Design
  Language) exactly. Set the colors, type scale, and spacing as CSS
  variables / Tailwind theme values once, then reuse them everywhere — no
  component should introduce a one-off color, border-radius, or shadow
  outside that system.
- Mobile-first responsive layout. Every core flow (view balance, add
  expense, settle up) must be fully usable on a ~375px-wide screen with no
  horizontal scroll.
- Use shadcn/ui components throughout (Card, Table, Dialog, Form, Avatar,
  Badge, Tabs, Select, Sonner toasts, Skeleton for loading states, Alert
  for empty/error states).
- Show a toast on every successful create/update/delete and a clear error
  message on failure.
- Implement light/dark mode using the same token system in both modes.
- Implement loading skeletons and empty states for every list/dashboard
  view (no blank screens, no raw "null"/"undefined" rendered to the user).
- Use tabular figures (`font-variant-numeric: tabular-nums`) on every
  monetary amount so columns of numbers align.

Hard design constraints — no exceptions, and don't ask me to relax these:
- No emojis anywhere in the UI: not in buttons, nav, empty states, toasts,
  or copy. Use lucide-react icons for any visual marker instead.
- No glassmorphism: no backdrop-blur translucent panels, no glowing
  borders, no frosted-glass cards.
- No decorative gradients scattered across cards, buttons, or backgrounds.
- Do not default to a generic AI-SaaS-template look. Specifically avoid:
  (a) cream background + high-contrast serif headline + terracotta accent,
  (b) near-black background + single neon/acid accent color, (c) a
  hairline-rule, zero-border-radius "broadsheet" layout used as the whole
  identity. SubSqueeze is a household ledger — design from that subject,
  not from generic dashboard defaults.
- The two balance colors (owed-to-you green, you-owe clay) are the only
  semantic colors in the app. Don't reuse them for anything unrelated to
  balance direction, and don't introduce additional accent colors.
- Keep motion minimal and functional (row appear, settle confirmation) —
  no ambient or scroll-triggered animation.
- Every screen, component, and state (including light/dark mode, loading,
  empty, and error states) should look like it came from the same
  considered design system, not like each page was designed independently.

ARCHITECTURE rules:
- Follow the folder structure in DesignDoc.md section 5 as closely as
  practical.
- All writes (create/update/delete) go through Server Actions, not client-
  side Supabase calls — keep validation and the "derive user identity from
  the authenticated session, never trust a client-passed user id" rule on
  the server.
- Reads can use Server Components with the Supabase server client directly.
- Do not add authorization checks in application code that duplicate what
  RLS already does — trust RLS as the authorization boundary, but do add
  basic input validation (Zod) before every write.
- Do not create a separate Express/Fastify backend — Next.js Server
  Actions and Route Handlers are the only "backend."

SETUP STEPS I need you to perform:
1. Scaffold the Next.js project (TypeScript, App Router, Tailwind, ESLint).
2. Initialize shadcn/ui and add the components listed above.
3. Set up the Supabase browser client, server client, and middleware
   session-refresh helper per @supabase/ssr's App Router pattern.
4. Create a .env.local.example file listing NEXT_PUBLIC_SUPABASE_URL and
   NEXT_PUBLIC_SUPABASE_ANON_KEY as required variables (do not invent
   real values — I will fill in .env.local myself with my actual Supabase
   project's URL and anon key).
5. Implement every feature in the "WHAT TO BUILD" list above.
6. After building, run the dev server and verify it boots without errors.
7. Write a short README.md explaining how to run the project locally
   (install deps, copy .env.local.example to .env.local, fill in Supabase
   credentials, run dev server).

Do not implement anything from the "out of scope" list in PID.md (no
payment gateway integration, no notifications, no recurring expenses, no
multi-currency, no debt-simplification algorithm). If you think something
in this prompt is ambiguous or conflicts with the schema file, stop and
ask me rather than guessing.
````

After Antigravity finishes its first pass, do a quick read-through of what it
built before moving to verification in §7 — agents occasionally take small
liberties (e.g., a slightly different folder layout); that's fine as long as
the schema and RLS rules in `supabase_schema.sql` weren't altered.

## 6. Run It Locally

```bash
cd subsqueeze            # or whatever Antigravity named the project folder
pnpm install
cp .env.local.example .env.local   # then fill in your real Supabase URL + anon key
pnpm dev
```

Visit `http://localhost:3000`.

## 7. Acceptance Checklist (manual QA before you trust it)

Use two different email addresses (two browser profiles or one normal +
one incognito window) to act as two separate users.

- [ ] User A signs up → a row appears in `public.users` automatically (check
      Supabase Table Editor)
- [ ] User A creates a cohort → appears in their cohort list, role = admin
- [ ] User B joins via the invite code → appears in the member list
- [ ] User A adds a ₱100 expense split equally between A and B → balances
      show "B owes A ₱50.00" (or "A owes B," whichever direction — just
      confirm it's exactly ₱50.00, not ₱49.99/₱50.01)
- [ ] Add an expense that doesn't divide evenly (e.g., ₱100 ÷ 3) → confirm
      the three shares sum to exactly ₱100.00
- [ ] Custom split: try to submit shares that don't sum to the total →
      blocked with a clear error
- [ ] User B records a settlement paying User A ₱50 → balance between them
      returns to ₱0.00 immediately
- [ ] User A deletes the original expense → its liability_fractions are
      gone too, but if there were other unrelated expenses/settlements,
      those are untouched (no cascading beyond the deleted expense)
- [ ] **Privacy check:** User A creates a second, separate cohort that B is
      *not* part of, adds an expense there → User B cannot see that cohort,
      its expenses, or its balances anywhere in the UI or via direct API
      calls
- [ ] Resize the browser to ~375px width → no horizontal scrolling, every
      button/form is reachable and usable
- [ ] Refresh the page mid-session → still logged in (session persists)
- [ ] Log out → redirected appropriately, can't navigate back into
      authenticated pages without logging in again

If any of these fail, that's your next entry in `03_Progress.md` → Known
Issues, and a good follow-up task to hand back to Antigravity with the
specific failing scenario described.

## 8. Deploy to Vercel

1. Push the project to a GitHub repo.
2. In Vercel: **New Project → Import** your repo.
3. Add the same environment variables from `.env.local` under **Project
   Settings → Environment Variables** (Production + Preview).
4. Deploy.
5. Back in Supabase: **Authentication → URL Configuration** — add your Vercel
   production URL (and any preview URLs you use) to the allowed redirect
   URLs, or auth callbacks will silently fail in production.
6. Re-run the §7 checklist against the live production URL.

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| "new row violates row-level security policy" on insert | You're inserting with a `user_id`/`payer_id` that doesn't match `auth.uid()` — always let the server derive identity from the session, never pass it from the client |
| User can see another cohort's data | RLS policy missing/disabled on a table, or a query is using the `service_role` key client-side by mistake |
| Split amounts off by a cent | Something did the math in JS floating point instead of `numeric`/decimal-safe arithmetic — push the calculation into Postgres or use a decimal-safe library |
| Auth redirect loop in production | Supabase redirect URL allowlist doesn't include your production domain (§8 step 5) |
| `useSearchParams() should be wrapped in a suspense boundary` build error | Common Next.js App Router gotcha — wrap the component using it in `<Suspense>` |

---

Once you're through §7 and §8, update `03_Progress.md` — Phase 9 should be
fully checked, and the project is shipped.
