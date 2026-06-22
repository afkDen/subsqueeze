-- =====================================================================
-- SubSqueeze DB — Migration 002
-- Run this in Supabase Dashboard → SQL Editor → New query → Run.
-- Adds: cohorts.budget_limit, expenses.is_personal, expenses.next_due_date, expenses.billing_cycle.
-- Safe to run once; will not alter columns if they already exist.
-- =====================================================================

-- 1. Add budget_limit to cohorts
alter table public.cohorts 
  add column if not exists budget_limit numeric(12,2) check (budget_limit > 0) default null;

-- 2. Add is_personal, next_due_date, and billing_cycle to expenses
alter table public.expenses 
  add column if not exists is_personal boolean not null default false,
  add column if not exists next_due_date date default null,
  add column if not exists billing_cycle text check (billing_cycle in ('monthly', 'yearly', 'one-time')) default 'monthly';
