'use server'

import { createClient } from '@/lib/supabase/server'
import { createCohortSchema, joinCohortSchema, updateCohortSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

export async function createCohort(prevState: any, formData: FormData) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' }
  }

  // Validate form data
  const rawName = formData.get('name')
  const rawDescription = formData.get('description')
  const validated = createCohortSchema.safeParse({
    name: rawName,
    description: rawDescription,
  })

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map(e => e.message).join(', '),
    }
  }

  const { name, description } = validated.data
  const cohortId = randomUUID()

  try {
    // Insert Cohort
    const { error: cohortError } = await supabase
      .from('cohorts')
      .insert({
        id: cohortId,
        name,
        description: description || null,
        created_by: user.id,
      })

    if (cohortError) {
      return { success: false, error: cohortError.message }
    }

    // Insert user into user_cohorts as admin
    const { error: memberError } = await supabase
      .from('user_cohorts')
      .insert({
        user_id: user.id,
        cohort_id: cohortId,
        role: 'admin',
      })

    if (memberError) {
      // Rollback: delete cohort if member insertion fails
      await supabase.from('cohorts').delete().eq('id', cohortId)
      return { success: false, error: 'Failed to assign cohort administrator.' }
    }

    revalidatePath('/dashboard')
    return { success: true, cohortId }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}

export async function joinCohort(prevState: any, formData: FormData) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' }
  }

  // Validate invite code
  const rawInviteCode = formData.get('invite_code')
  const validated = joinCohortSchema.safeParse({ invite_code: rawInviteCode })

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map(e => e.message).join(', '),
    }
  }

  const { invite_code } = validated.data

  try {
    // Find cohort by invite code
    const { data: cohort, error: cohortFindError } = await supabase
      .from('cohorts')
      .select('id')
      .eq('invite_code', invite_code)
      .maybeSingle()

    if (cohortFindError || !cohort) {
      return { success: false, error: 'Cohort not found. Please verify the invite code.' }
    }

    // Join cohort
    const { error: joinError } = await supabase
      .from('user_cohorts')
      .insert({
        user_id: user.id,
        cohort_id: cohort.id,
        role: 'member',
      })

    if (joinError) {
      if (joinError.code === '23505') { // unique/primary key violation
        return { success: false, error: 'You are already a member of this cohort.' }
      }
      return { success: false, error: joinError.message }
    }

    revalidatePath('/dashboard')
    return { success: true, cohortId: cohort.id }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}

export async function leaveCohort(cohortId: string) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' }
  }

  try {
    const { error } = await supabase
      .from('user_cohorts')
      .delete()
      .match({ user_id: user.id, cohort_id: cohortId })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}

export async function deleteCohort(cohortId: string) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' }
  }

  try {
    const { data, error } = await supabase
      .from('cohorts')
      .delete()
      .eq('id', cohortId)
      .select()

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Cohort deletion failed. Verify that you are the administrator and that you have enabled the RLS delete policy for cohorts.',
      }
    }

    revalidatePath('/dashboard')
    revalidatePath(`/cohorts/${cohortId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}

export async function updateCohort(cohortId: string, prevState: any, formData: FormData) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized. Please log in.' }
  }

  // Validate form data
  const rawName = formData.get('name')
  const rawDescription = formData.get('description')
  const rawBudgetLimit = formData.get('budget_limit')
  
  const validated = updateCohortSchema.safeParse({
    name: rawName,
    description: rawDescription,
    budget_limit: rawBudgetLimit,
  })

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map(e => e.message).join(', '),
    }
  }

  const { name, description, budget_limit } = validated.data

  try {
    // Perform update (RLS will check if the user is an admin of this cohort)
    const { error } = await supabase
      .from('cohorts')
      .update({
        name,
        description: description || null,
        budget_limit: budget_limit ? parseFloat(budget_limit) : null,
      })
      .eq('id', cohortId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    revalidatePath(`/cohorts/${cohortId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}
