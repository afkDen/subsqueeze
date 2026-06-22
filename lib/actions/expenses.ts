'use server'

import { createClient } from '@/lib/supabase/server'
import { expenseSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'

interface CreateExpenseInput {
  cohortId: string
  description: string
  category: 'subscription' | 'general'
  total_amount: string
  transaction_date: string
  split_mode: 'equal' | 'custom'
  splits: { user_id: string; amount_owed: string }[]
  is_personal?: boolean
  next_due_date?: string | null
  billing_cycle?: 'monthly' | 'yearly' | 'one-time'
}

export async function createExpense(input: CreateExpenseInput) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' }
  }

  // Validate inputs schema
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  // Validate split sum
  const totalCents = Math.round(parseFloat(input.total_amount) * 100)
  const splitsSumCents = input.splits.reduce((sum, s) => sum + Math.round(parseFloat(s.amount_owed) * 100), 0)

  if (totalCents !== splitsSumCents) {
    return {
      success: false,
      error: `Split sum (₱${(splitsSumCents / 100).toFixed(2)}) must exactly equal the total amount (₱${input.total_amount}). Difference: ₱${((totalCents - splitsSumCents) / 100).toFixed(2)}`,
    }
  }

  try {
    // Insert expense
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        payer_id: user.id,
        cohort_id: input.cohortId,
        description: input.description,
        category: input.category,
        total_amount: parseFloat(input.total_amount),
        transaction_date: input.transaction_date,
        is_personal: input.is_personal || false,
        next_due_date: input.next_due_date || null,
        billing_cycle: input.billing_cycle || 'monthly',
      })
      .select()
      .single()

    if (expenseError) {
      return { success: false, error: expenseError.message }
    }

    // Insert liability fractions
    const { error: splitsError } = await supabase
      .from('liability_fractions')
      .insert(
        input.splits.map(s => ({
          expense_id: expense.id,
          user_id: s.user_id,
          amount_owed: parseFloat(s.amount_owed),
          is_settled: false,
        }))
      )

    if (splitsError) {
      // Rollback: delete the created expense
      await supabase.from('expenses').delete().eq('id', expense.id)
      return { success: false, error: `Failed to create liability splits: ${splitsError.message}` }
    }

    revalidatePath(`/cohorts/${input.cohortId}`)
    revalidatePath('/dashboard')
    return { success: true, expenseId: expense.id }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}

export async function updateExpense(
  expenseId: string,
  input: Omit<CreateExpenseInput, 'cohortId'>
) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' }
  }

  // Validate inputs schema
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  // Get original expense to verify creator identity and support rollbacks
  const { data: originalExpense, error: fetchError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .single()

  if (fetchError || !originalExpense) {
    return { success: false, error: 'Expense not found.' }
  }

  if (originalExpense.payer_id !== user.id) {
    return { success: false, error: 'Only the creator of this expense can modify it.' }
  }

  // Validate split sum
  const totalCents = Math.round(parseFloat(input.total_amount) * 100)
  const splitsSumCents = input.splits.reduce((sum, s) => sum + Math.round(parseFloat(s.amount_owed) * 100), 0)

  if (totalCents !== splitsSumCents) {
    return {
      success: false,
      error: `Split sum (₱${(splitsSumCents / 100).toFixed(2)}) must exactly equal the total amount (₱${input.total_amount}).`,
    }
  }

  // Fetch original splits for rollback purposes
  const { data: originalSplits, error: fetchSplitsError } = await supabase
    .from('liability_fractions')
    .select('*')
    .eq('expense_id', expenseId)

  if (fetchSplitsError || !originalSplits) {
    return { success: false, error: 'Failed to retrieve original expense details.' }
  }

  try {
    // 1. Update the parent expense row
    const { error: updateExpenseError } = await supabase
      .from('expenses')
      .update({
        description: input.description,
        category: input.category,
        total_amount: parseFloat(input.total_amount),
        transaction_date: input.transaction_date,
        is_personal: input.is_personal || false,
        next_due_date: input.next_due_date || null,
        billing_cycle: input.billing_cycle || 'monthly',
      })
      .eq('id', expenseId)

    if (updateExpenseError) {
      return { success: false, error: updateExpenseError.message }
    }

    // 2. Delete old liability fractions
    const { error: deleteSplitsError } = await supabase
      .from('liability_fractions')
      .delete()
      .eq('expense_id', expenseId)

    if (deleteSplitsError) {
      // Revert expense update
      await supabase.from('expenses').update({
        description: originalExpense.description,
        category: originalExpense.category,
        total_amount: originalExpense.total_amount,
        transaction_date: originalExpense.transaction_date,
        is_personal: originalExpense.is_personal,
        next_due_date: originalExpense.next_due_date,
        billing_cycle: originalExpense.billing_cycle,
      }).eq('id', expenseId)

      return { success: false, error: `Failed to update splits: ${deleteSplitsError.message}` }
    }

    // 3. Insert new liability fractions
    const { error: insertSplitsError } = await supabase
      .from('liability_fractions')
      .insert(
        input.splits.map(s => ({
          expense_id: expenseId,
          user_id: s.user_id,
          amount_owed: parseFloat(s.amount_owed),
          is_settled: false,
        }))
      )

    if (insertSplitsError) {
      // ROLLBACK: Re-insert original splits
      await supabase.from('liability_fractions').insert(
        originalSplits.map(s => ({
          expense_id: s.expense_id,
          user_id: s.user_id,
          amount_owed: s.amount_owed,
          is_settled: s.is_settled,
        }))
      )

      // ROLLBACK: Revert parent expense details
      await supabase.from('expenses').update({
        description: originalExpense.description,
        category: originalExpense.category,
        total_amount: originalExpense.total_amount,
        transaction_date: originalExpense.transaction_date,
        is_personal: originalExpense.is_personal,
        next_due_date: originalExpense.next_due_date,
        billing_cycle: originalExpense.billing_cycle,
      }).eq('id', expenseId)

      return { success: false, error: `Failed to write new liability splits: ${insertSplitsError.message}` }
    }

    revalidatePath(`/cohorts/${originalExpense.cohort_id}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}

export async function deleteExpense(expenseId: string) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' }
  }

  try {
    // Retrieve expense to find cohortId for path revalidation
    const { data: expense, error: fetchError } = await supabase
      .from('expenses')
      .select('cohort_id, payer_id')
      .eq('id', expenseId)
      .single()

    if (fetchError || !expense) {
      return { success: false, error: 'Expense not found.' }
    }

    if (expense.payer_id !== user.id) {
      return { success: false, error: 'Only the creator of this expense can delete it.' }
    }

    // Delete expense. Foreign key cascade deletes liability fractions automatically in Postgres!
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    revalidatePath(`/cohorts/${expense.cohort_id}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}
