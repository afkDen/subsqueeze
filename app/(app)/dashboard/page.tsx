import { createClient } from '@/lib/supabase/server'
import { getUserCohortSummary } from '@/lib/balances'
import { CreateCohortDialog } from '@/components/create-cohort-dialog'
import { JoinCohortDialog } from '@/components/join-cohort-dialog'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ArrowUpRight, FolderOpen, ArrowRight, Info, Calendar, Sparkles, TrendingUp, TrendingDown } from 'lucide-react'
import { redirect } from 'next/navigation'
import { format, parseISO } from 'date-fns'

export const revalidate = 0 // Disable cache for real-time balances

export default async function DashboardPage() {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Get user cohort summary (contains aggregate balance + cohort lists)
  const balanceSummary = await getUserCohortSummary(user.id)

  // Fetch the role for each cohort (to show in the table)
  const { data: memberships } = await supabase
    .from('user_cohorts')
    .select('cohort_id, role')
    .eq('user_id', user.id)

  const roleMap = new Map<string, string>()
  memberships?.forEach(m => {
    roleMap.set(m.cohort_id, m.role)
  })

  // Format currency helper
  const formatCurrency = (amount: number) => {
    const absVal = Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `₱${absVal}`
  }

  // Calculate Monthly Spend and other mockup statistics
  const currentMonthStart = new Date()
  currentMonthStart.setDate(1)
  currentMonthStart.setHours(0, 0, 0, 0)
  
  const prevMonthStart = new Date(currentMonthStart)
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)
  
  const formattedCurrentStart = currentMonthStart.toISOString().split('T')[0]
  const formattedPrevStart = prevMonthStart.toISOString().split('T')[0]

  const cohortIds = balanceSummary.cohorts.map(c => c.cohort_id)
  
  let userMonthlySpendThisMonth = 0
  let userMonthlySpendLastMonth = 0
  let sharedSavings = 0
  let upcomingSubscriptions: any[] = []
  let cohortBudgets: { cohortId: string; name: string; spend: number; limit: number }[] = []

  if (cohortIds.length > 0) {
    // Fetch expenses from all cohorts where the user is a member
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('*, liability_fractions(*), cohorts(name, budget_limit)')
      .in('cohort_id', cohortIds)
      .gte('transaction_date', formattedPrevStart)
    
    allExpenses?.forEach(exp => {
      const isCurrentMonth = exp.transaction_date >= formattedCurrentStart
      const isLastMonth = exp.transaction_date < formattedCurrentStart && exp.transaction_date >= formattedPrevStart

      // Find the user's split in this expense
      const userSplit = exp.liability_fractions?.find((lf: any) => lf.user_id === user.id)
      
      if (userSplit) {
        const amountOwed = Number(userSplit.amount_owed)
        if (isCurrentMonth) {
          userMonthlySpendThisMonth += amountOwed
          
          // Calculate shared savings (amount saved by splitting)
          if (!exp.is_personal && Number(exp.total_amount) > amountOwed) {
            sharedSavings += (Number(exp.total_amount) - amountOwed)
          }
        } else if (isLastMonth) {
          userMonthlySpendLastMonth += amountOwed
        }
      }

      // Track upcoming renewals (must be in the current/future month)
      if (exp.category === 'subscription' && exp.next_due_date) {
        const todayStr = new Date().toISOString().split('T')[0]
        if (exp.next_due_date >= todayStr) {
          // Avoid duplicate subscription entries by checking id
          if (!upcomingSubscriptions.some(sub => sub.id === exp.id)) {
            upcomingSubscriptions.push({
              id: exp.id,
              cohortId: exp.cohort_id,
              cohortName: exp.cohorts?.name || 'Unknown',
              description: exp.description,
              total_amount: Number(exp.total_amount),
              next_due_date: exp.next_due_date,
              billing_cycle: exp.billing_cycle,
              is_personal: exp.is_personal,
            })
          }
        }
      }
    })

    // Calculate Cohort Budgets for the current month
    const cohortSpends = new Map<string, number>()
    allExpenses?.forEach(exp => {
      const isCurrentMonth = exp.transaction_date >= formattedCurrentStart
      if (isCurrentMonth) {
        const current = cohortSpends.get(exp.cohort_id) || 0
        cohortSpends.set(exp.cohort_id, current + Number(exp.total_amount))
      }
    })

    // Get cohort details for cohorts with budget limits
    const { data: cohortsData } = await supabase
      .from('cohorts')
      .select('id, name, budget_limit')
      .in('id', cohortIds)

    cohortsData?.forEach(c => {
      if (c.budget_limit) {
        cohortBudgets.push({
          cohortId: c.id,
          name: c.name,
          spend: cohortSpends.get(c.id) || 0,
          limit: Number(c.budget_limit),
        })
      }
    })
  }

  // Sort upcoming renewals by next due date
  upcomingSubscriptions.sort((a, b) => (a.next_due_date < b.next_due_date ? -1 : 1))

  // Calculate MoM trend details
  let trendText = ''
  let trendDirection: 'up' | 'down' | 'flat' = 'flat'
  if (userMonthlySpendLastMonth > 0) {
    const pct = ((userMonthlySpendThisMonth - userMonthlySpendLastMonth) / userMonthlySpendLastMonth) * 100
    const absPct = Math.abs(pct).toFixed(0)
    if (pct > 0) {
      trendText = `+${absPct}% from last month`
      trendDirection = 'up'
    } else if (pct < 0) {
      trendText = `-${absPct}% from last month`
      trendDirection = 'down'
    } else {
      trendText = 'same as last month'
      trendDirection = 'flat'
    }
  } else {
    trendText = 'first month logging spend'
  }

  const isOwed = balanceSummary.total_net > 0
  const isOwe = balanceSummary.total_net < 0

  return (
    <div className="space-y-8">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Ledger Dashboard</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Overview of your shared household and subscription expenses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <JoinCohortDialog />
          <CreateCohortDialog />
        </div>
      </div>

      {/* Main Bento Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Monthly Spend Bento Card */}
        <Card className="border border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase font-sans">
              Monthly Spend (You)
            </p>
            <div className="mt-2 flex flex-col justify-start">
              <span className="text-4xl font-heading font-extrabold tracking-tight text-foreground tabular-nums">
                {formatCurrency(userMonthlySpendThisMonth)}
              </span>
              <span className="text-xs font-medium text-muted-foreground mt-1 font-sans flex items-center gap-1">
                {trendDirection === 'up' && <TrendingUp className="h-3.5 w-3.5 text-owe" />}
                {trendDirection === 'down' && <TrendingDown className="h-3.5 w-3.5 text-owed" />}
                <span>{trendText}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Overall credit/debit Running Balance Bento Card */}
        <Card className="border border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase font-sans">
              Overall Balance
            </p>
            <div className="mt-2 flex flex-col justify-start">
              <span
                className={`text-4xl font-heading font-extrabold tracking-tight tabular-nums ${
                  isOwed ? 'text-owed' : isOwe ? 'text-owe' : 'text-muted-foreground'
                }`}
              >
                {formatCurrency(balanceSummary.total_net)}
              </span>
              <span className="text-xs font-medium text-muted-foreground mt-1 font-sans">
                {isOwed ? 'owed to you overall' : isOwe ? 'you owe overall' : 'all settled up'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Insight Bento Card */}
        <Card className="border border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase font-sans flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              SubSqueeze Insight
            </p>
            <div className="mt-2 text-sm text-foreground font-sans font-medium">
              You are member of <span className="font-semibold text-primary">{cohortIds.length} cohorts</span>.
              {sharedSavings > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  By splitting subscriptions, you saved <span className="font-bold text-owed">{formatCurrency(sharedSavings)}</span> this month!
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Start splitting digital subscriptions to reduce your monthly costs.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left main area: Cohorts List */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-semibold text-foreground">My Cohorts</h2>
            </div>

            {balanceSummary.cohorts.length === 0 ? (
              <Card className="border border-border bg-card">
                <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-heading font-medium text-foreground">No Cohorts Yet</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm font-sans">
                    Create a cohort for your household or join an existing one using an invite code to start splitting expenses.
                  </p>
                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <JoinCohortDialog />
                    <CreateCohortDialog />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="border border-border rounded-md bg-card overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50 border-b border-border">
                    <TableRow>
                      <TableHead className="font-heading font-medium text-foreground py-3 pl-4 text-left">Cohort</TableHead>
                      <TableHead className="font-heading font-medium text-foreground py-3 text-left">Your Role</TableHead>
                      <TableHead className="font-heading font-medium text-foreground py-3 text-right">Balance</TableHead>
                      <TableHead className="py-3 pr-4 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balanceSummary.cohorts.map((cohort) => {
                      const role = roleMap.get(cohort.cohort_id) || 'member'
                      const cohortNet = cohort.net_balance
                      const cOwed = cohortNet > 0
                      const cOwe = cohortNet < 0

                      return (
                        <TableRow key={cohort.cohort_id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <TableCell className="py-4 pl-4 font-sans text-left">
                            <Link href={`/cohorts/${cohort.cohort_id}`} className="font-semibold text-foreground hover:underline block">
                              {cohort.cohort_name}
                            </Link>
                          </TableCell>
                          <TableCell className="py-4 font-sans text-left">
                            <Badge variant="outline" className="border-border text-foreground font-medium text-xs rounded-sm capitalize">
                              {role}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 text-right font-sans font-medium tabular-nums">
                            <span className={cOwed ? 'text-owed' : cOwe ? 'text-owe' : 'text-muted-foreground'}>
                              {cOwed ? '+' : ''}{formatCurrency(cohortNet)}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 pr-4 text-right">
                            <Link
                              href={`/cohorts/${cohort.cohort_id}`}
                              className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'h-8 w-8 p-0 text-muted-foreground hover:text-foreground flex items-center justify-center' })}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar area: Household Budgets & Upcoming Renewals */}
        <div className="lg:col-span-1 space-y-6">
          {/* Cohort Budgets Section */}
          {cohortBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase font-sans">
                Household Budgets
              </h3>
              <div className="space-y-4">
                {cohortBudgets.map(cb => {
                  const spendPct = Math.round((cb.spend / cb.limit) * 100)
                  return (
                    <Card key={cb.cohortId} className="border border-border bg-card">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <Link href={`/cohorts/${cb.cohortId}`} className="font-semibold text-sm text-foreground hover:underline">
                              {cb.name}
                            </Link>
                            <p className="text-xs text-muted-foreground font-sans mt-0.5">
                              {formatCurrency(cb.spend)} spent of {formatCurrency(cb.limit)}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-foreground tabular-nums">
                            {spendPct}%
                          </span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden border border-border">
                          <div 
                            className="bg-primary h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, spendPct)}%` }}
                          ></div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upcoming Renewals Sidebar Section */}
          {upcomingSubscriptions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase font-sans">
                  Upcoming Renewals
                </h3>
              </div>
              <div className="space-y-3">
                {upcomingSubscriptions.slice(0, 4).map(sub => (
                  <Card key={sub.id} className="border border-border bg-card hover:bg-muted/10 transition-colors">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-sans block truncate max-w-[120px]">
                          {sub.cohortName}
                        </span>
                        <span className="font-semibold text-sm text-foreground block mt-0.5 truncate max-w-[120px]">
                          {sub.description}
                        </span>
                        <span className="inline-block mt-2 px-1 py-0.5 text-[8px] font-mono font-semibold uppercase tracking-wider rounded-sm border border-border text-muted-foreground">
                          {sub.is_personal ? 'Private' : 'Squeezed'}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-heading font-bold text-sm text-foreground tabular-nums block">
                          {formatCurrency(sub.total_amount)}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-sans block mt-0.5">
                          Due {format(parseISO(sub.next_due_date), 'MMM d')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
