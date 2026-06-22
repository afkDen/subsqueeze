import { createClient } from '@/lib/supabase/server'
import { ExpenseForm } from '@/components/expense-form'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const revalidate = 0

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Fetch cohort details to verify membership
  const { data: cohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('name')
    .eq('id', cohortId)
    .maybeSingle()

  if (cohortError || !cohort) {
    // If not a member, RLS will hide the cohort row
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
      />
    </div>
  )
}
