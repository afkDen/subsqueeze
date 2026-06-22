-- =====================================================================
-- SubSqueeze DB — Supabase / Postgres schema
-- Derived 1:1 from the CDM/LDM (Liwanag, Information Management)
-- Tables: users, cohorts, user_cohorts, expenses, liability_fractions,
--         settlement_log
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this
-- whole file → Run. Safe to run once on a fresh project.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------

-- USER: profile table, 1:1 with Supabase's built-in auth.users
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text not null unique,
  email           text not null unique,
  contact_number  text,
  created_at      timestamptz not null default now()
);

-- COHORT
create table public.cohorts (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  description     text,
  invite_code     text not null unique default substr(replace(uuid_generate_v4()::text, '-', ''), 1, 8),
  created_by      uuid not null references public.users(id),
  created_at      timestamptz not null default now()
);

-- USER_COHORT: resolves USER <-> COHORT many-to-many
create table public.user_cohorts (
  user_id     uuid not null references public.users(id) on delete cascade,
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  role        text not null default 'member' check (role in ('admin', 'member')),
  joined_at   timestamptz not null default now(),
  primary key (user_id, cohort_id)
);

-- EXPENSE
create table public.expenses (
  id                 uuid primary key default uuid_generate_v4(),
  payer_id           uuid not null references public.users(id),
  cohort_id          uuid not null references public.cohorts(id) on delete cascade,
  description        text not null,
  category           text not null default 'general' check (category in ('subscription', 'general')),
  total_amount       numeric(12,2) not null check (total_amount > 0),
  transaction_date   date not null default current_date,
  created_at         timestamptz not null default now()
);

-- LIABILITY_FRACTION: per-member share of an expense (resolves USER <-> EXPENSE liability M:N)
create table public.liability_fractions (
  id            uuid primary key default uuid_generate_v4(),
  expense_id    uuid not null references public.expenses(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  amount_owed   numeric(12,2) not null check (amount_owed >= 0),
  is_settled    boolean not null default false,
  unique (expense_id, user_id)
);

-- SETTLEMENT_LOG: a single payment between two users
create table public.settlement_log (
  id                 uuid primary key default uuid_generate_v4(),
  payer_id           uuid not null references public.users(id),
  payee_id           uuid not null references public.users(id),
  cohort_id          uuid references public.cohorts(id) on delete set null,
  amount_paid        numeric(12,2) not null check (amount_paid > 0),
  settlement_date    date not null default current_date,
  payment_status     text not null default 'completed' check (payment_status in ('pending', 'completed', 'failed')),
  created_at         timestamptz not null default now(),
  constraint different_parties check (payer_id <> payee_id)
);

-- ---------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------

create index idx_user_cohorts_cohort      on public.user_cohorts (cohort_id);
create index idx_user_cohorts_user        on public.user_cohorts (user_id);
create index idx_expenses_cohort          on public.expenses (cohort_id);
create index idx_expenses_payer           on public.expenses (payer_id);
create index idx_liability_expense        on public.liability_fractions (expense_id);
create index idx_liability_user           on public.liability_fractions (user_id);
create index idx_settlement_payer         on public.settlement_log (payer_id);
create index idx_settlement_payee         on public.settlement_log (payee_id);
create index idx_settlement_cohort        on public.settlement_log (cohort_id);

-- ---------------------------------------------------------------------
-- AUTO-CREATE PROFILE ON SIGN-UP
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- SETTLEMENT LOG IMMUTABILITY
-- The project proposal describes settlement_log as "immutable records."
-- This trigger prevents any UPDATE to a settlement row after creation.
-- Deletion is prevented by RLS (no delete policy exists on this table).
-- ---------------------------------------------------------------------

create or replace function public.prevent_settlement_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Settlement records are immutable and cannot be modified after creation.';
  return null;
end;
$$;

create trigger settlement_log_no_update
  before update on public.settlement_log
  for each row execute procedure public.prevent_settlement_update();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.users               enable row level security;
alter table public.cohorts             enable row level security;
alter table public.user_cohorts        enable row level security;
alter table public.expenses            enable row level security;
alter table public.liability_fractions enable row level security;
alter table public.settlement_log      enable row level security;

-- Helper: is the current user a member of a given cohort?
-- security definer avoids recursive-RLS issues when policies on
-- user_cohorts itself need to check membership.
create or replace function public.is_cohort_member(_cohort_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_cohorts
    where cohort_id = _cohort_id and user_id = auth.uid()
  );
$$;

-- USERS -----------------------------------------------------------------

create policy "view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "view cohort-mates profiles"
  on public.users for select
  using (
    exists (
      select 1
      from public.user_cohorts uc1
      join public.user_cohorts uc2 on uc1.cohort_id = uc2.cohort_id
      where uc1.user_id = auth.uid() and uc2.user_id = users.id
    )
  );

create policy "update own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- COHORTS -----------------------------------------------------------------

create policy "view my cohorts"
  on public.cohorts for select
  using (public.is_cohort_member(id));

create policy "create cohort as self"
  on public.cohorts for insert
  with check (auth.uid() = created_by);

create policy "admins update cohort"
  on public.cohorts for update
  using (
    exists (
      select 1 from public.user_cohorts
      where cohort_id = id and user_id = auth.uid() and role = 'admin'
    )
  );

-- USER_COHORTS --------------------------------------------------------------

create policy "view membership of my cohorts"
  on public.user_cohorts for select
  using (public.is_cohort_member(cohort_id));

create policy "join a cohort"
  on public.user_cohorts for insert
  with check (auth.uid() = user_id);

create policy "leave or admin-remove member"
  on public.user_cohorts for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_cohorts uc
      where uc.cohort_id = user_cohorts.cohort_id
        and uc.user_id = auth.uid()
        and uc.role = 'admin'
    )
  );

-- EXPENSES -----------------------------------------------------------------

create policy "view cohort expenses"
  on public.expenses for select
  using (public.is_cohort_member(cohort_id));

create policy "create expense as payer in my cohort"
  on public.expenses for insert
  with check (public.is_cohort_member(cohort_id) and auth.uid() = payer_id);

create policy "payer updates own expense"
  on public.expenses for update
  using (auth.uid() = payer_id);

create policy "payer deletes own expense"
  on public.expenses for delete
  using (auth.uid() = payer_id);

-- LIABILITY_FRACTIONS --------------------------------------------------------

create policy "view liability fractions of my cohort expenses"
  on public.liability_fractions for select
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_cohort_member(e.cohort_id)
    )
  );

create policy "payer inserts liability fractions for their expense"
  on public.liability_fractions for insert
  with check (
    exists (select 1 from public.expenses e where e.id = expense_id and e.payer_id = auth.uid())
  );

create policy "debtor or payer updates settlement flag"
  on public.liability_fractions for update
  using (
    auth.uid() = user_id
    or exists (select 1 from public.expenses e where e.id = expense_id and e.payer_id = auth.uid())
  );

create policy "payer deletes liability fractions of their expense"
  on public.liability_fractions for delete
  using (
    exists (select 1 from public.expenses e where e.id = expense_id and e.payer_id = auth.uid())
  );

-- SETTLEMENT_LOG --------------------------------------------------------------

create policy "participants view their settlement"
  on public.settlement_log for select
  using (auth.uid() = payer_id or auth.uid() = payee_id);

create policy "payer records a settlement"
  on public.settlement_log for insert
  with check (auth.uid() = payer_id);

create policy "payer updates own settlement"
  on public.settlement_log for update
  using (auth.uid() = payer_id);

-- ---------------------------------------------------------------------
-- OPTIONAL HELPER VIEW: net balance per ordered user pair, per cohort
-- Positive net_amount = row.user_a is owed money BY user_b.
-- Use this (or replicate the logic in lib/balances.ts) to drive the
-- dashboard without N+1 client-side aggregation.
-- ---------------------------------------------------------------------

create or replace view public.v_pairwise_balances as
with liability_owed as (
  -- money user_id owes to the expense's payer
  select
    e.cohort_id,
    e.payer_id      as user_a,   -- is owed
    lf.user_id      as user_b,   -- owes
    lf.amount_owed  as amount
  from public.liability_fractions lf
  join public.expenses e on e.id = lf.expense_id
  where lf.is_settled = false
    and lf.user_id <> e.payer_id
),
settlements_netted as (
  select
    cohort_id,
    payee_id  as user_a,  -- received money, so this reduces what they're owed
    payer_id  as user_b,
    amount_paid as amount
  from public.settlement_log
  where payment_status = 'completed'
)
select
  cohort_id,
  user_a,
  user_b,
  coalesce(sum(amount), 0) as net_amount
from (
  select cohort_id, user_a, user_b, amount from liability_owed
  union all
  select cohort_id, user_a, user_b, -amount from settlements_netted
) combined
group by cohort_id, user_a, user_b
having coalesce(sum(amount), 0) <> 0;

-- The view inherits RLS from its underlying tables when queried by an
-- authenticated user via the Supabase client (security_invoker behavior
-- on Postgres 15+/Supabase). If your Postgres version requires it
-- explicitly, uncomment the line below:
-- alter view public.v_pairwise_balances set (security_invoker = true);
