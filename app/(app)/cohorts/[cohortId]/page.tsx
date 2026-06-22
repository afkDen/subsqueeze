import { createClient } from '@/lib/supabase/server'
import { getCohortBalances } from '@/lib/balances'
import { SettleUpDialog } from '@/components/settle-up-dialog'
import { ActivityFeed, ExpenseFeedItem, SettlementFeedItem } from '@/components/activity-feed'
import { leaveCohort } from '@/lib/actions/cohorts'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Users, ArrowLeft, LogOut, Copy, Info, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'

// Client Components
import { CopyButton } from '@/components/copy-button'
import { LeaveCohortButton } from '@/components/leave-cohort-button'
import { DeleteCohortButton } from '@/components/delete-cohort-button'
import { EditCohortDialog } from '@/components/edit-cohort-dialog'

export const revalidate = 0 // Disable cache for real-time balances

export default async function CohortPage({
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

  // Fetch cohort details (includes budget_limit)
  const { data: cohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('*')
    .eq('id', cohortId)
    .maybeSingle()

  if (cohortError || !cohort) {
    // If RLS blocks it, it returns empty
    redirect('/dashboard')
  }

  // Fetch cohort membership to find role
  const { data: membership } = await supabase
    .from('user_cohorts')
    .select('role')
    .match({ user_id: user.id, cohort_id: cohortId })
    .single()

  const userRole = membership?.role || 'member'

  // Fetch cohort members list
  const { data: membersData } = await supabase
    .from('user_cohorts')
    .select('user_id, role, users(username, email)')
    .eq('cohort_id', cohortId)

  const members = membersData?.map(m => {
    const profile = m.users as any
    return {
      userId: m.user_id,
      role: m.role,
      username: profile?.username || 'Unknown',
      email: profile?.email || '',
    }
  }) || []

  // Fetch pairwise balances
  const pairwiseBalances = await getCohortBalances(cohortId)

  // Calculate what the current user owes or is owed in this cohort
  let userNetBalance = 0
  const oweList: { payeeId: string; payeeName: string; amount: number }[] = []
  const owedList: { debtorId: string; debtorName: string; amount: number }[] = []

  pairwiseBalances.forEach(bal => {
    if (bal.user_1 === user.id) {
      // positive: user_1 (me) is owed by user_2; negative: user_2 owes user_1
      userNetBalance += bal.net_amount
      if (bal.net_amount > 0) {
        owedList.push({
          debtorId: bal.user_2,
          debtorName: bal.user_2_username,
          amount: bal.net_amount,
        })
      } else if (bal.net_amount < 0) {
        oweList.push({
          payeeId: bal.user_2,
          payeeName: bal.user_2_username,
          amount: Math.abs(bal.net_amount),
        })
      }
    } else if (bal.user_2 === user.id) {
      // positive: user_1 owes user_2 (me); negative: user_2 (me) owes user_1
      userNetBalance -= bal.net_amount
      if (bal.net_amount < 0) {
        owedList.push({
          debtorId: bal.user_1,
          debtorName: bal.user_1_username,
          amount: Math.abs(bal.net_amount),
        })
      } else if (bal.net_amount > 0) {
        oweList.push({
          payeeId: bal.user_1,
          payeeName: bal.user_1_username,
          amount: bal.net_amount,
        })
      }
    }
  })

  // Fetch raw expenses for activity feed (including is_personal, next_due_date, billing_cycle, splits)
  const { data: rawExpenses } = await supabase
    .from('expenses')
    .select('*, users!payer_id(username), liability_fractions(*, users(username))')
    .eq('cohort_id', cohortId)
    .order('transaction_date', { ascending: false })

  const expenses: ExpenseFeedItem[] = rawExpenses?.map(e => ({
    id: e.id,
    payer_id: e.payer_id,
    payer_username: (e.users as any)?.username || 'Unknown',
    description: e.description,
    category: e.category as 'subscription' | 'general',
    total_amount: Number(e.total_amount),
    transaction_date: e.transaction_date,
    created_at: e.created_at,
    is_personal: e.is_personal,
    next_due_date: e.next_due_date,
    billing_cycle: e.billing_cycle,
    splits: (e.liability_fractions as any[])?.map(lf => ({
      user_id: lf.user_id,
      username: lf.users?.username || 'Unknown',
      amount_owed: Number(lf.amount_owed),
    })) || [],
  })) || []

  // Fetch raw settlements for activity feed
  const { data: rawSettlements } = await supabase
    .from('settlement_log')
    .select('*, payer:users!payer_id(username), payee:users!payee_id(username)')
    .eq('cohort_id', cohortId)
    .order('settlement_date', { ascending: false })

  const settlements: SettlementFeedItem[] = rawSettlements?.map(s => ({
    id: s.id,
    payer_id: s.payer_id,
    payer_username: (s.payer as any)?.username || 'Unknown',
    payee_id: s.payee_id,
    payee_username: (s.payee as any)?.username || 'Unknown',
    amount_paid: Number(s.amount_paid),
    settlement_date: s.settlement_date,
    created_at: s.created_at,
  })) || []

  const formatCurrency = (amount: number) => {
    const absVal = Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `₱${absVal}`
  }

  const isOwed = userNetBalance > 0
  const isOwe = userNetBalance < 0

  // Calculate cohort spend for the current month
  const today = new Date()
  const firstDayOfMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const cohortMonthlySpend = expenses
    .filter(e => e.transaction_date >= firstDayOfMonthStr)
    .reduce((sum, e) => sum + e.total_amount, 0)

  // Get upcoming renewals in this cohort (where next_due_date is in the future)
  const todayStr = today.toISOString().split('T')[0]
  const upcomingSubscriptions = expenses
    .filter(e => e.category === 'subscription' && e.next_due_date && e.next_due_date >= todayStr)
    .sort((a, b) => (a.next_due_date! < b.next_due_date! ? -1 : 1))
    .slice(0, 3) // Show top 3 upcoming

  return (
    <div className="space-y-8">
      {/* Back link & header */}
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors font-sans"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">{cohort.name}</h1>
              <Badge variant="outline" className="border-border text-foreground rounded-sm text-xs font-semibold capitalize">
                {userRole}
              </Badge>
            </div>
            {cohort.description && (
              <p className="text-sm text-muted-foreground mt-1 font-sans">{cohort.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/cohorts/${cohortId}/expenses/new`}
              className={buttonVariants({ variant: 'default', size: 'default', className: 'bg-primary text-primary-foreground hover:opacity-90 font-medium py-2 px-4 rounded-md flex items-center' })}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Expense
            </Link>
            {userRole === 'admin' && (
              <EditCohortDialog 
                cohortId={cohortId}
                initialName={cohort.name}
                initialDescription={cohort.description}
                initialBudgetLimit={cohort.budget_limit}
              />
            )}
            {userRole === 'admin' && (
              <DeleteCohortButton cohortId={cohortId} cohortName={cohort.name} />
            )}
            <LeaveCohortButton cohortId={cohortId} isCreator={cohort.created_by === user.id} />
          </div>
        </div>
      </div>

      {/* Cohort Invite Info */}
      <Card className="border border-border bg-card">
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground font-sans">
                Cohort Invite Code
              </p>
              <p className="text-sm text-foreground font-sans mt-0.5">
                Share this code with roommates to let them join this cohort.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold bg-muted px-2 py-1 border border-border rounded-sm uppercase tracking-wider text-foreground">
              {cohort.invite_code}
            </span>
            <CopyButton text={cohort.invite_code} />
          </div>
        </CardContent>
      </Card>

      {/* Budget Limit Progress Bar */}
      {cohort.budget_limit && (
        <Card className="border border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex justify-between items-end mb-3">
              <div>
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase font-sans">
                  Household Budget
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-heading font-extrabold tracking-tight text-foreground tabular-nums">
                    {formatCurrency(cohortMonthlySpend)}
                  </span>
                  <span className="text-sm text-muted-foreground font-sans">
                    / {formatCurrency(cohort.budget_limit)} limit
                  </span>
                </div>
              </div>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {Math.round((cohortMonthlySpend / cohort.budget_limit) * 100)}%
              </span>
            </div>
            <div className="w-full bg-muted h-3 rounded-full overflow-hidden border border-border">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.round((cohortMonthlySpend / cohort.budget_limit) * 100))}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2.5 font-sans">
              {cohortMonthlySpend <= cohort.budget_limit ? (
                <span>You have <span className="font-semibold text-foreground">{formatCurrency(cohort.budget_limit - cohortMonthlySpend)}</span> remaining this month.</span>
              ) : (
                <span className="text-owe font-semibold">Exceeded budget by {formatCurrency(cohortMonthlySpend - cohort.budget_limit)}.</span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cohort Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-border bg-card md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase font-sans">
              Your Cohort Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <span
                className={`text-4xl font-heading font-extrabold tracking-tight tabular-nums ${
                  isOwed ? 'text-owed' : isOwe ? 'text-owe' : 'text-muted-foreground'
                }`}
              >
                {formatCurrency(userNetBalance)}
              </span>
              <span className="text-xs font-medium text-muted-foreground mt-1 font-sans">
                {isOwed ? 'owed to you in this cohort' : isOwe ? 'you owe in this cohort' : 'all settled up'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Ledger actions card */}
        <Card className="border border-border bg-card md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-heading font-semibold text-foreground">Repayment Channels</CardTitle>
          </CardHeader>
          <CardContent>
            {oweList.length === 0 && owedList.length === 0 ? (
              <p className="text-sm text-muted-foreground font-sans">No outstanding balances between members.</p>
            ) : (
              <div className="space-y-4">
                {/* Who you owe */}
                {oweList.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground font-sans">You Owe</p>
                    <div className="divide-y divide-border border border-border rounded-sm">
                      {oweList.map(item => (
                        <div key={item.payeeId} className="flex items-center justify-between p-3 bg-muted/10">
                          <span className="text-sm font-sans">
                            You owe <span className="font-semibold">{item.payeeName}</span>{' '}
                            <span className="font-heading font-bold text-owe tabular-nums">{formatCurrency(item.amount)}</span>
                          </span>
                          <SettleUpDialog
                            cohortId={cohortId}
                            payeeId={item.payeeId}
                            payeeName={item.payeeName}
                            suggestedAmount={item.amount}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Who owes you */}
                {owedList.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground font-sans">You Are Owed By</p>
                    <div className="divide-y divide-border border border-border rounded-sm">
                      {owedList.map(item => (
                        <div key={item.debtorId} className="flex items-center justify-between p-3 bg-muted/10">
                          <span className="text-sm font-sans">
                            <span className="font-semibold">{item.debtorName}</span> owes you{' '}
                            <span className="font-heading font-bold text-owed tabular-nums">{formatCurrency(item.amount)}</span>
                          </span>
                          <span className="text-xs text-muted-foreground font-sans italic">Awaiting their payment</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Renewals in Cohort */}
      {upcomingSubscriptions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-heading font-semibold text-foreground">Upcoming Renewals</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {upcomingSubscriptions.map(sub => (
              <Card key={sub.id} className="border border-border bg-card">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">{sub.description}</h4>
                    <p className="text-xs text-muted-foreground font-sans mt-0.5">
                      Due {format(parseISO(sub.next_due_date!), 'MMM d, yyyy')}
                    </p>
                    <span className="inline-block mt-2 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider rounded-sm border border-border text-muted-foreground">
                      {sub.is_personal ? 'Private' : 'Squeezed'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-heading font-bold text-sm text-foreground tabular-nums block">
                      {formatCurrency(sub.total_amount)}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize block mt-0.5">
                      {sub.billing_cycle}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Members List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-heading font-semibold text-foreground">Cohort Members</h2>
          </div>
          <Card className="border border-border bg-card">
            <Table>
              <TableHeader className="bg-muted/30 border-b border-border">
                <TableRow>
                  <TableHead className="font-heading font-medium text-foreground py-2 text-left pl-3">Member</TableHead>
                  <TableHead className="font-heading font-medium text-foreground py-2 text-right pr-3">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(member => (
                  <TableRow key={member.userId} className="border-b border-border last:border-0">
                    <TableCell className="py-3 font-sans text-left pl-3">
                      <div className="font-medium text-foreground">{member.username}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[150px]">{member.email}</div>
                    </TableCell>
                    <TableCell className="py-3 text-right pr-3 font-sans capitalize">
                      <Badge variant="outline" className="border-border text-foreground font-medium text-[10px] rounded-sm py-0">
                        {member.role}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Activity Ledger Feed */}
        <div className="lg:col-span-2">
          <ActivityFeed
            cohortId={cohortId}
            expenses={expenses}
            settlements={settlements}
            currentUserId={user.id}
          />
        </div>
      </div>
    </div>
  )
}
