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
import { Plus, Users, ArrowLeft, LogOut, Copy, Info } from 'lucide-react'

export const revalidate = 0 // Disable cache for real-time balances

// A simple client wrapper is not needed since we can do copy action with CSS or native browser or write a small client component.
// Let's write the whole page as a server component, and we can make the copy button a small client component, or just a simple button.
// Let's create a Client Component for copy button and leave cohort button.
import { CopyButton } from '@/components/copy-button'
import { LeaveCohortButton } from '@/components/leave-cohort-button'
import { DeleteCohortButton } from '@/components/delete-cohort-button'

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

  // Fetch cohort details
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

  // Fetch raw expenses for activity feed
  const { data: rawExpenses } = await supabase
    .from('expenses')
    .select('*, users!payer_id(username)')
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
  const isSettled = Math.abs(userNetBalance) < 0.005

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
