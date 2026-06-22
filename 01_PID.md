# Project Initiation Document (PID)
**Project:** SubSqueeze — Shared Expense & Subscription Settlement App
**Based on:** SubSqueeze DB CDM/LDM (Liwanag, BSCS 2-4, PUP — Information Management)
**Owner:** Mark Daniel L. Liwanag
**Document version:** 1.0
**Last updated:** 2026-06-22

---

## 1. Background

University dormmates, apartment co-tenants, and student peer groups routinely split
recurring digital subscriptions (Netflix, Spotify, Canva Pro) and staggered physical
living costs (groceries, utilities, travel). They track this informally — group chats,
screenshots, mental math — which produces three named information-management gaps
(from the project proposal, in order of severity):

1. **Lost transaction history.** No audit trail exists. Determining who missed a
   subscription payment over a six-month period is practically impossible without a
   centralized ledger.
2. **Fractional debt discrepancies.** Not all expenses split evenly. A grocery
   receipt might be 60/40; a subscription might apply to only 3 of 5 people.
   Informal systems fail to track overlapping, uneven splits across multiple groups.
3. **Complex debt routing ("dependency hell").** When A owes B and B simultaneously
   owes C, manual tracking cannot recognize the overlapping debt graph. This forces
   unnecessary multi-step payments instead of simplifying the repayment chain.

The academic deliverable (SubSqueeze DB) solved the **data modeling** side: a
normalized 3NF relational schema — `USER`, `COHORT`, `USER_COHORT`, `EXPENSE`,
`LIABILITY_FRACTION`, `SETTLEMENT_LOG` — that eliminates the update and deletion
anomalies described in the CDM/LDM report.

This PID scopes the next step: a working web application backed by that schema.
Problems 1 and 2 are fully addressed in v1. Problem 3 is addressed at the **data
layer** in v1 — the schema captures every debt relationship needed to run a
simplification algorithm — and the algorithm itself ships in v2 (see §4.2).

## 2. Problem Statement

Build a web app where members of a shared living space ("cohort") can log shared
expenses, automatically split them among members, see real-time balances (who
owes whom, and how much), and record settlements — all backed by the normalized
relational model already designed, with no spreadsheet or chat-thread bookkeeping.

## 3. Objectives

| # | Objective | Success looks like |
|---|---|---|
| O1 | Implement the LDM faithfully in Postgres/Supabase | All 6 entities present, FK-enforced, RLS-protected |
| O2 | Let users self-organize into cohorts | Create/join/leave a cohort, see members |
| O3 | Let any member log an expense and split it | Equal or custom split, fractions sum to total |
| O4 | Surface real-time net balances per cohort | Dashboard shows "you owe / you're owed" per person |
| O5 | Let users record settlements | Settling a debt updates balances and history immediately |
| O6 | Ship a usable, mobile-friendly UI | Fully responsive, works one-handed on a phone |
| O7 | Deploy a public, working instance | Live URL, anyone with an account can use it |

## 4. Scope

### 4.1 In scope (v1 / MVP)
- Email/password auth (Supabase Auth)
- Create / join cohorts (via invite code)
- Add expense with a **category** (subscription or general) → split equally or by
  custom fixed amounts among selected members
- Auto-generated `LIABILITY_FRACTION` rows per expense
- Dashboard: net balance per person, per cohort, and overall
- Record a settlement (manual "I paid X back"); settlement records are **immutable
  once created** — they cannot be edited or deleted
- Activity/ledger feed (expenses + settlements, chronological)
- Edit/delete an expense you created (cascades to its liability fractions)
- Responsive UI (mobile-first), light/dark mode

### 4.2 Out of scope (v1) — candidates for v2

**Debt routing simplification** is one of the three core stated problems in the
project proposal but is intentionally deferred. The v1 schema fully captures the
multi-party debt graph (every `LIABILITY_FRACTION` row is a directed edge), so
the algorithm can be bolted on in v2 without schema changes. What v2 adds is the
computation layer: given the current graph of outstanding liabilities, suggest the
minimum set of transactions to settle the whole cohort.

Other v2 candidates:
- Real payment processing / payment gateway integration (GCash, Maya, etc.)
- Push/email notifications and reminders
- Recurring/auto-generated subscription expenses
- Multi-currency support
- Native mobile app (PWA only, if anything)

## 5. Target Users

- **Primary:** Students sharing a dorm/apartment splitting recurring subscriptions and bills.
- **Secondary:** Family households tracking shared costs among adult members.
- Both groups are non-technical end users; the UI must read as a consumer app
  (Splitwise-grade), not a database front-end.

## 6. Deliverables

1. This PID (`01_PID.md`)
2. Design Doc (`02_Design_Doc.md`) — architecture, schema, UI/feature spec
3. Progress tracker (`03_Progress.md`) — living checklist, updated as you build
4. Build Guide (`04_Build_Guide.md`) — prerequisites, Supabase setup, env vars, and
   the master prompt for Antigravity 2.0
5. `supabase_schema.sql` — runnable schema + RLS, derived 1:1 from the LDM
6. The deployed web application itself

## 7. Recommended Tech Stack (summary — full detail in Design Doc)

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 15 (App Router, TypeScript) | Best-supported stack by current AI coding agents; server actions remove need for a separate API layer |
| Styling | Tailwind CSS v4 | Fast, AI-friendly, no context-switching to a CSS file |
| Components | shadcn/ui | Accessible, themeable, copy-in (no opaque dependency) |
| Backend / DB | Supabase (Postgres) | Matches the LDM directly; built-in Auth + Row Level Security |
| Hosting | Vercel | Zero-config Next.js deploys, free tier sufficient |
| Forms/validation | React Hook Form + Zod | Type-safe, pairs naturally with Server Actions |

## 8. High-Level Timeline

| Phase | Scope | Target effort |
|---|---|---|
| 0 — Planning | These 4 docs (done) | half a day |
| 1 — Environment setup | Supabase project, schema, Next.js scaffold | 1 session |
| 2 — Auth + Cohorts | Sign up/in, create/join cohort | 1–2 sessions |
| 3 — Expenses + Splits | Add expense, liability fraction generation | 1–2 sessions |
| 4 — Balances + Settlements | Dashboard math, settlement recording | 1–2 sessions |
| 5 — Polish | Responsive pass, empty/error/loading states | 1 session |
| 6 — Deploy | Vercel + Supabase production config | half a session |

This is a solo, AI-agent-assisted build, so "sessions" rather than calendar weeks —
see `03_Progress.md` for the actual living schedule.

## 9. Success Criteria

- A second user (a real dormmate/family member) can sign up, join a cohort, add an
  expense, and see correct balances without being walked through it.
- All financial math (splits, balances, settlement netting) is verifiably correct —
  see acceptance checklist in the Build Guide.
- No table in the live schema violates the normalization guarantees from the
  original CDM/LDM report (no duplicated expense data, no repeating groups).
- The app is usable on a phone screen without horizontal scrolling.

## 10. Assumptions

- You (the developer) have or can create: a Supabase account, a Vercel account, a
  GitHub account, and access to Antigravity 2.0.
- Single currency (PHP) is acceptable for v1.
- "Settlement" is self-reported (no payment gateway verification) for v1.
- One person can belong to multiple cohorts (e.g., dorm + family).

## 11. Constraints

- Free-tier Supabase and Vercel limits (sufficient for a small personal/student-group
  user base, not built for scale).
- AI-agent-assisted build: instructions in the Build Guide are written to be
  unambiguous enough for an autonomous coding agent to execute correctly in one pass.

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Floating-point rounding in splits (₱100 ÷ 3) | Balances don't reconcile to the total | Use `numeric(12,2)` in Postgres, never `float`; assign rounding remainder to the expense creator |
| RLS misconfiguration exposes other cohorts' data | Privacy/data leak | Ship the provided RLS policies as-is; test with two separate test accounts before adding features |
| Scope creep (notifications, payments, etc.) mid-build | MVP never ships | Out-of-scope list in §4.2 is enforced; new ideas go to the v2 backlog in `03_Progress.md` |
| AI agent drifts from the schema/design doc | Inconsistent code, broken FKs | Always paste schema + design doc into agent context (see Build Guide prompt) |

## 13. Document Map

```
01_PID.md            ← you are here (why, what, scope)
02_Design_Doc.md      ← how (architecture, schema, screens, components)
03_Progress.md        ← tracking (checklist, changelog, backlog)
04_Build_Guide.md     ← doing (setup steps + Antigravity 2.0 prompt)
supabase_schema.sql   ← the actual schema to run in Supabase
```
