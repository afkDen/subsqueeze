# Progress Tracker
**Project:** SubSqueeze
**How to use this file:** check items off as you complete them, update the
**Status** line in each phase, and log notable decisions/blockers in the
Changelog at the bottom. Keep this file in your repo root and commit it as you go.

**Overall status:** IN PROGRESS — planning complete, build not started
**Last updated:** 2026-06-22

---

## Phase 0 — Planning & Docs
**Status:** DONE — 2026-06-22

- [x] PID written (`01_PID.md`)
- [x] Design Doc written (`02_Design_Doc.md`)
- [x] SQL schema drafted (`supabase_schema.sql`)
- [x] Build Guide + Antigravity 2.0 prompt written (`04_Build_Guide.md`)

## Phase 1 — Environment Setup
**Status:** DONE — 2026-06-22

- [x] Supabase project created
- [x] `supabase_schema.sql` run successfully (no errors)
- [x] Two test accounts created, RLS sanity-checked (Account A cannot see Account B's un-shared cohort)
- [x] Next.js project scaffolded (TypeScript, App Router, Tailwind)
- [x] shadcn/ui initialized + base components added
- [x] `.env.local` populated, app boots locally (`pnpm dev`)
- [x] GitHub repo created, initial commit pushed

## Phase 2 — Auth
**Status:** DONE — 2026-06-22

- [x] Sign-up page (email/password)
- [x] Login page
- [x] `public.users` profile auto-created on sign-up (verify trigger fires)
- [x] Middleware redirects unauthenticated users away from `(app)` routes
- [x] Logout works, session clears

## Phase 3 — Cohorts
**Status:** DONE — 2026-06-22

- [x] Create cohort form
- [x] Join cohort via invite code
- [x] Cohort list page (shows all cohorts I'm in)
- [x] Cohort home page (members list)
- [x] Leave cohort

## Phase 4 — Expenses & Splits
**Status:** DONE — 2026-06-22

- [x] Add expense form (description, category selector, amount, date, member picker)
- [x] Equal split logic (remainder cents to payer)
- [x] Custom split logic (validates shares sum to total)
- [x] Expense + liability_fraction rows created transactionally
- [x] Expense ledger / list view per cohort (filterable by category)
- [x] Edit expense
- [x] Delete expense (confirm liability_fractions cascade correctly)

## Phase 5 — Balances & Settlements
**Status:** DONE — 2026-06-22

- [x] Balance calculation logic/view (`v_cohort_balances` or equivalent)
- [x] Per-cohort balance breakdown UI
- [x] Overall dashboard (aggregate across cohorts)
- [x] "Settle up" form, pre-filled suggested amount
- [x] Immutability note displayed in settle-up confirmation UI
- [x] No edit/delete UI on any settlement_log entry (verified by inspecting DOM, not just hidden)
- [x] Settlement insert + balance recalculation reflected immediately
- [x] Optional: mark individual liability_fraction as settled from ledger

## Phase 6 — Activity Feed
**Status:** DONE — 2026-06-22

- [x] Combined chronological feed (expenses + settlements) per cohort
- [x] Empty states (no expenses yet, no cohorts yet)

## Phase 7 — Polish
**Status:** DONE — 2026-06-22

- [x] Full responsive pass (test at 375px width)
- [x] Loading states (skeletons) on all data fetches
- [x] Error states (failed mutation, network error)
- [x] Light/dark mode toggle
- [x] Toast notifications on all create/update/delete actions
- [x] Empty-cohort / empty-balance copy reviewed (no "undefined" or raw nulls visible)

## Phase 8 — Testing & QA
**Status:** DONE — 2026-06-22

- [x] Manual acceptance checklist (see `04_Build_Guide.md` §7) passed end-to-end
- [x] Two-account cross-cohort privacy test passed
- [x] Rounding test: split an odd amount 3 ways, confirm sum reconciles exactly
- [x] Mobile device (real phone, not just devtools) smoke test

## Phase 9 — Deployment
**Status:** IN PROGRESS

- [ ] Vercel project linked to GitHub repo
- [ ] Production env vars set in Vercel
- [ ] Supabase Auth redirect URLs updated for production domain
- [ ] Production smoke test (sign up, add expense, settle up)
- [ ] Share live URL

---

## Changelog
*(newest first — add an entry every time you make a meaningful decision, hit a
blocker, or finish a phase)*

- **2026-06-22** — QA and Bug Review: fixed critical SSR/hydration mismatches in expense form date, settle-up date, and auth copyright year footer. Integrated robust server-side schema checking in createExpense/updateExpense, validation of user role privileges in deleteCohort, balance verification in leaveCohort, and permission checks in toggleLiabilitySettled. Verified production compilation and pushed changes to remote main branch for Vercel deployment.
- **2026-06-22** — Completed and verified all MVP codebase functionalities including auth, cohort creation/joining/deletion, cents-safe rounding split logic, activity feed, and balance view integration. Passed TypeScript and build checks. Preparing for Vercel deployment.
- **2026-06-22** — Project planning docs created (PID, Design Doc, Build Guide,
  SQL schema). Build not yet started.

---

## Backlog (v2 ideas — not in current scope)

- [ ] Debt routing simplification — one of the three stated problems in the project
      proposal ("dependency hell"). Schema is already ready for it; v2 adds the
      graph-minimization algorithm on top of existing LIABILITY_FRACTION data.
- [ ] Recurring/subscription auto-expenses
- [ ] Email/push reminders for outstanding balances
- [ ] Real payment gateway integration (GCash/Maya) for verified settlements
- [ ] Multi-currency support

## Known Issues
*(log bugs here as you find them, move to Changelog once fixed)*

- None yet.

---

## Backlog (v2 ideas — not in current scope)

- [ ] Debt routing simplification — one of the three stated problems in the project
      proposal ("dependency hell"). Schema is already ready for it; v2 adds the
      graph-minimization algorithm on top of existing LIABILITY_FRACTION data.
- [ ] Recurring/subscription auto-expenses
- [ ] Email/push reminders for outstanding balances
- [ ] Real payment gateway integration (GCash/Maya) for verified settlements
- [ ] Multi-currency support

## Known Issues
*(log bugs here as you find them, move to Changelog once fixed)*

- None yet.
