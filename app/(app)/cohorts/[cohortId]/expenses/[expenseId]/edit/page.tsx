import { createClient } from '@/lib/supabase/server'
import { ExpenseForm } from '@/components/expense-form'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const revalidate = 0

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ cohortId: string; expenseId: string }>
}) {
  const { cohortId, expenseId } = await params
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Fetch expense details
  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .single()

  if (expenseError || !expense) {
    redirect(`/cohorts/${cohortId}`)
  }

  // Check if current user is the payer
  if (expense.payer_id !== user.id) {
    // Only the creator can edit
    redirect(`/cohorts/${cohortId}`)
  }

  // Fetch cohort details to verify membership
  const { data: cohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('name')
    .eq('id', cohortId)
    .maybeSingle()

  if (cohortError || !cohort) {
    redirect('/dashboard')
  }

  // Fetch cohort members list
  const { data: membersData, error: membersError } = await supabase
    .from('user_cohorts')
    .select('user_id, users(username)')
    .eq('cohort_id', cohortId)

  if (membersError) {
    redirect(`/cohorts/${cohortId}`)
  }

  const cohortMembers = membersData.map(m => {
    const profile = m.users as any
    return {
      userId: m.user_id,
      username: profile?.username || 'Unknown',
    }
  })

  // Fetch liability fractions (splits) for this expense
  const { data: splitsData, error: splitsError } = await supabase
    .from('liability_fractions')
    .select('user_id, amount_owed')
    .eq('expense_id', expenseId)

  if (splitsError || !splitsData) {
    redirect(`/cohorts/${cohortId}`)
  }

  const mappedExpense = {
    id: expense.id,
    description: expense.description,
    category: expense.category as 'subscription' | 'general',
    total_amount: Number(expense.total_amount),
    transaction_date: expense.transaction_date,
    splits: splitsData.map(s => ({
      user_id: s.user_id,
      amount_owed: Number(s.amount_owed),
    })),
    is_personal: expense.is_personal,
    next_due_date: expense.next_due_date,
    billing_cycle: expense.billing_cycle,
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link
        href={`/cohorts/${cohortId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors font-sans"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {cohort.name}
      </Link>

      <ExpenseForm
        cohortId={cohortId}
        cohortMembers={cohortMembers}
        currentUserId={user.id}
        initialExpense={mappedExpense}
      />
    </div>
  )
}
