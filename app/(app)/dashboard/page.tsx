import { createClient } from '@/lib/supabase/server'
import { getUserCohortSummary } from '@/lib/balances'
import { CreateCohortDialog } from '@/components/create-cohort-dialog'
import { JoinCohortDialog } from '@/components/join-cohort-dialog'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ArrowUpRight, FolderOpen, ArrowRight, UserPlus, Info } from 'lucide-react'
import { redirect } from 'next/navigation'

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

  const isOwed = balanceSummary.total_net > 0
  const isOwe = balanceSummary.total_net < 0
  const isSettled = balanceSummary.total_net === 0

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

      {/* Signature Running Balance Element */}
      <Card className="border border-border bg-card">
        <CardContent className="pt-6">
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase font-sans">
              Overall Balance
            </p>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-baseline gap-2 justify-center sm:justify-start">
              <span
                className={`text-5xl font-heading font-extrabold tracking-tight tabular-nums ${
                  isOwed ? 'text-owed' : isOwe ? 'text-owe' : 'text-muted-foreground'
                }`}
              >
                {formatCurrency(balanceSummary.total_net)}
              </span>
              <span className="text-sm font-medium text-muted-foreground font-sans">
                {isOwed ? 'owed to you overall' : isOwe ? 'you owe overall' : 'all settled up'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cohorts Ledger */}
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
  )
}
