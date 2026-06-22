'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteExpense } from '@/lib/actions/expenses'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format, parseISO } from 'date-fns'
import { Edit2, Trash2, Calendar, FileText, CheckCircle2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

export interface ExpenseFeedItem {
  id: string
  payer_id: string
  payer_username: string
  description: string
  category: 'subscription' | 'general'
  total_amount: number
  transaction_date: string
  created_at: string
}

export interface SettlementFeedItem {
  id: string
  payer_id: string
  payer_username: string
  payee_id: string
  payee_username: string
  amount_paid: number
  settlement_date: string
  created_at: string
}

interface ActivityFeedProps {
  cohortId: string
  expenses: ExpenseFeedItem[]
  settlements: SettlementFeedItem[]
  currentUserId: string
}

type FeedEvent = 
  | { type: 'expense'; date: Date; created: Date; data: ExpenseFeedItem }
  | { type: 'settlement'; date: Date; created: Date; data: SettlementFeedItem }

export function ActivityFeed({ cohortId, expenses, settlements, currentUserId }: ActivityFeedProps) {
  const [filter, setFilter] = useState<'all' | 'subscription' | 'general'>('all')
  const [isPending, startTransition] = useTransition()

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  // Combine and sort events
  const allEvents: FeedEvent[] = [
    ...expenses.map(e => ({
      type: 'expense' as const,
      date: parseISO(e.transaction_date),
      created: new Date(e.created_at),
      data: e
    })),
    ...settlements.map(s => ({
      type: 'settlement' as const,
      date: parseISO(s.settlement_date),
      created: new Date(s.created_at),
      data: s
    }))
  ].sort((a, b) => {
    // Primary sort: Date descending
    const dateDiff = b.date.getTime() - a.date.getTime()
    if (dateDiff !== 0) return dateDiff
    // Secondary sort: Created_at descending
    return b.created.getTime() - a.created.getTime()
  })

  // Filter events
  const filteredEvents = allEvents.filter(event => {
    if (filter === 'all') return true
    if (event.type === 'expense') {
      return event.data.category === filter
    }
    return false // Hide settlements when filtering by expense category
  })

  const handleDelete = async (expenseId: string) => {
    if (!window.confirm('Are you sure you want to delete this expense? This will also delete all liability fractions.')) {
      return
    }

    startTransition(async () => {
      const res = await deleteExpense(expenseId)
      if (res.success) {
        toast.success('Expense deleted successfully')
      } else {
        toast.error(res.error || 'Failed to delete expense')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Category Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-heading font-semibold text-foreground">Activity Ledger</h3>
        <Tabs value={filter} onValueChange={(val: any) => setFilter(val)} className="w-auto">
          <TabsList className="bg-muted border border-border h-9 rounded-md p-1">
            <TabsTrigger value="all" className="rounded-sm px-3 py-1 text-xs font-medium">All</TabsTrigger>
            <TabsTrigger value="subscription" className="rounded-sm px-3 py-1 text-xs font-medium">Subscriptions</TabsTrigger>
            <TabsTrigger value="general" className="rounded-sm px-3 py-1 text-xs font-medium">General</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Feed Container */}
      {filteredEvents.length === 0 ? (
        <Card className="border border-border bg-card p-8 text-center text-muted-foreground text-sm font-sans">
          No ledger activity found.
        </Card>
      ) : (
        <div className="border border-border rounded-md bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {filteredEvents.map(event => {
              if (event.type === 'expense') {
                const exp = event.data
                const isCreator = exp.payer_id === currentUserId

                return (
                  <div key={exp.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="bg-muted border border-border p-2 rounded-sm text-foreground shrink-0 mt-0.5">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {exp.description}
                        </p>
                        <p className="text-xs text-muted-foreground font-sans mt-0.5">
                          Paid by <span className="font-medium text-foreground">{isCreator ? 'You' : exp.payer_username}</span> &middot; {format(event.date, 'MMM d, yyyy')}
                        </p>
                        <div className="mt-1 flex gap-1">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider py-0 px-1 border-border text-muted-foreground rounded-sm">
                            {exp.category}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-heading font-bold text-sm text-foreground tabular-nums">
                          {formatCurrency(exp.total_amount)}
                        </span>
                      </div>
                      
                      {/* Action buttons (only for expense creator) */}
                      {isCreator && (
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/cohorts/${cohortId}/expenses/${exp.id}/edit`}
                            className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'h-8 w-8 text-muted-foreground hover:text-foreground' })}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            onClick={() => handleDelete(exp.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              } else {
                const set = event.data
                const isPayer = set.payer_id === currentUserId
                const isPayee = set.payee_id === currentUserId

                return (
                  <div key={set.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="bg-muted border border-border p-2 rounded-sm text-owed shrink-0 mt-0.5">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground">
                          {isPayer ? (
                            <span>You paid <span className="font-bold">{set.payee_username}</span></span>
                          ) : isPayee ? (
                            <span><span className="font-bold">{set.payer_username}</span> paid you</span>
                          ) : (
                            <span><span className="font-bold">{set.payer_username}</span> paid <span className="font-bold">{set.payee_username}</span></span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground font-sans mt-0.5">
                          Settlement Payment &middot; {format(event.date, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right pr-2">
                        <span className="font-heading font-bold text-sm text-owed tabular-nums">
                          {formatCurrency(set.amount_paid)}
                        </span>
                      </div>
                      {/* IMPORTANT: Settlement records are immutable, so there are NO edit/delete buttons here */}
                    </div>
                  </div>
                )
              }
            })}
          </div>
        </div>
      )}
    </div>
  )
}
