'use server'

import { createClient } from '@/lib/supabase/server'
import { settlementSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'

interface RecordSettlementInput {
  payeeId: string
  cohortId: string
  amount: string
  date: string
}

export async function recordSettlement(input: RecordSettlementInput) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' }
  }

  if (user.id === input.payeeId) {
    return { success: false, error: 'You cannot record a settlement with yourself.' }
  }

  // Validate form data
  const validated = settlementSchema.safeParse({
    payee_id: input.payeeId,
    cohort_id: input.cohortId,
    amount_paid: input.amount,
    settlement_date: input.date,
  })

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map(e => e.message).join(', '),
    }
  }

  const { payee_id, cohort_id, amount_paid, settlement_date } = validated.data

  try {
    // Insert settlement row. Settlement logs are database-enforced as immutable (trigger prevent_settlement_update).
    const { error: insertError } = await supabase
      .from('settlement_log')
      .insert({
        payer_id: user.id,
        payee_id: payee_id,
        cohort_id: cohort_id,
        amount_paid: parseFloat(amount_paid),
        settlement_date: settlement_date,
        payment_status: 'completed',
      })

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    revalidatePath(`/cohorts/${cohort_id}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}

/**
 * Manually marks a liability fraction as settled or unsettled (optional feature).
 */
export async function toggleLiabilitySettled(liabilityId: string, isSettled: boolean, cohortId: string) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' }
  }

  try {
    const { error } = await supabase
      .from('liability_fractions')
      .update({ is_settled: isSettled })
      .eq('id', liabilityId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath(`/cohorts/${cohortId}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}
