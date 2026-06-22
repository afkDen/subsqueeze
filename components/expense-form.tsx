'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createExpense, updateExpense } from '@/lib/actions/expenses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Info, Save, X } from 'lucide-react'
import { toast } from 'sonner'

interface Member {
  userId: string
  username: string
}

interface InitialExpense {
  id: string
  description: string
  category: 'subscription' | 'general'
  total_amount: number
  transaction_date: string
  splits: { user_id: string; amount_owed: number }[]
}

interface ExpenseFormProps {
  cohortId: string
  cohortMembers: Member[]
  currentUserId: string
  initialExpense?: InitialExpense
}

export function ExpenseForm({ cohortId, cohortMembers, currentUserId, initialExpense }: ExpenseFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form fields
  const [description, setDescription] = useState(initialExpense?.description || '')
  const [category, setCategory] = useState<'subscription' | 'general'>(initialExpense?.category || 'general')
  const [totalAmount, setTotalAmount] = useState(initialExpense?.total_amount ? initialExpense.total_amount.toFixed(2) : '')
  const [transactionDate, setTransactionDate] = useState(
    initialExpense?.transaction_date || new Date().toISOString().split('T')[0]
  )
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')

  // Selected members in the split (defaults to all)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    initialExpense?.splits.map(s => s.user_id) || cohortMembers.map(m => m.userId)
  )

  // Custom split amounts entered by the user (stored as user_id -> string amount)
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})

  // Calculated shares for display and submission (stored as user_id -> string amount)
  const [calculatedSplits, setCalculatedSplits] = useState<Record<string, string>>({})

  // Errors state
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Check if we are in Edit mode
  const isEdit = !!initialExpense

  // Initialize custom splits if in edit mode
  useEffect(() => {
    if (initialExpense) {
      const customMap: Record<string, string> = {}
      initialExpense.splits.forEach(s => {
        customMap[s.user_id] = s.amount_owed.toFixed(2)
      })
      setCustomAmounts(customMap)
      
      // Determine split mode (if they aren't all equal, set it to custom)
      const firstVal = initialExpense.splits[0]?.amount_owed
      const allEqual = initialExpense.splits.every(s => s.amount_owed === firstVal)
      setSplitMode(allEqual ? 'equal' : 'custom')
    }
  }, [initialExpense])

  // Recalculate splits whenever totalAmount, selected members, splitMode, or customAmounts change
  useEffect(() => {
    const amount = parseFloat(totalAmount)
    if (isNaN(amount) || amount <= 0 || selectedMemberIds.length === 0) {
      setCalculatedSplits({})
      return
    }

    const totalCents = Math.round(amount * 100)
    const newSplits: Record<string, string> = {}

    if (splitMode === 'equal') {
      const N = selectedMemberIds.length
      const baseShareCents = Math.floor(totalCents / N)
      const remainderCents = totalCents % N

      // Payer is currentUserId
      const payerInSplitIndex = selectedMemberIds.indexOf(currentUserId)
      
      selectedMemberIds.forEach((id, index) => {
        let cents = baseShareCents
        // Assign remainder cents to the payer if they are in the split, otherwise to the first member in the split
        if (payerInSplitIndex !== -1) {
          if (id === currentUserId) {
            cents += remainderCents
          }
        } else {
          if (index === 0) {
            cents += remainderCents
          }
        }
        newSplits[id] = (cents / 100).toFixed(2)
      })
    } else {
      // Custom splits
      selectedMemberIds.forEach(id => {
        const val = customAmounts[id] || '0.00'
        newSplits[id] = val
      })
    }

    setCalculatedSplits(newSplits)
  }, [totalAmount, selectedMemberIds, splitMode, customAmounts, currentUserId])

  // Calculate sum and validation details
  const currentAmount = parseFloat(totalAmount) || 0
  const totalCents = Math.round(currentAmount * 100)
  
  const sumOfSplitsCents = Object.values(calculatedSplits).reduce(
    (sum, val) => sum + Math.round((parseFloat(val) || 0) * 100),
    0
  )

  const isSumMatching = totalCents === sumOfSplitsCents
  const difference = (totalCents - sumOfSplitsCents) / 100

  // Handle member checkbox toggle
  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(memberId)) {
        // Prevent deselecting if it's the last member
        if (prev.length === 1) return prev
        return prev.filter(id => id !== memberId)
      } else {
        return [...prev, memberId]
      }
    })
  }

  // Handle custom amount input change
  const handleCustomAmountChange = (memberId: string, value: string) => {
    // Basic formatting constraint check (digits and up to 2 decimal places)
    if (value !== '' && !/^\d+(\.\d{0,2})?$/.test(value)) {
      return
    }
    setCustomAmounts(prev => ({
      ...prev,
      [memberId]: value,
    }))
  }

  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const parsedAmount = parseFloat(totalAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Total amount must be greater than 0')
      return
    }

    if (selectedMemberIds.length === 0) {
      setErrorMsg('At least one member must be selected to split the expense')
      return
    }

    if (!isSumMatching) {
      setErrorMsg(`The sum of splits (${(sumOfSplitsCents / 100).toFixed(2)}) must exactly equal the total amount (${parsedAmount.toFixed(2)}). Difference: ₱${difference.toFixed(2)}`)
      return
    }

    // Prepare splits for database
    const finalSplits = selectedMemberIds.map(id => ({
      user_id: id,
      amount_owed: calculatedSplits[id] || '0.00',
    }))

    startTransition(async () => {
      let res
      if (isEdit && initialExpense) {
        res = await updateExpense(initialExpense.id, {
          description,
          category,
          total_amount: totalAmount,
          transaction_date: transactionDate,
          split_mode: splitMode,
          splits: finalSplits,
        })
      } else {
        res = await createExpense({
          cohortId,
          description,
          category,
          total_amount: totalAmount,
          transaction_date: transactionDate,
          split_mode: splitMode,
          splits: finalSplits,
        })
      }

      if (res.success) {
        toast.success(isEdit ? 'Expense updated successfully!' : 'Expense created successfully!')
        router.push(`/cohorts/${cohortId}`)
      } else {
        setErrorMsg(res.error || 'Failed to submit expense')
        toast.error(res.error || 'Failed to submit expense')
      }
    })
  }

  return (
    <Card className="border border-border bg-card max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-heading font-bold text-foreground">
          {isEdit ? 'Edit Expense' : 'Add New Expense'}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {isEdit ? 'Modify details of your ledger entry' : 'Log a shared expense and split it among cohort members'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <Alert variant="destructive" className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <AlertDescription className="text-sm font-sans">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">Description</Label>
              <Input
                id="description"
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Netflix subscription, Groceries"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium text-foreground">Category</Label>
              <Select
                value={category}
                onValueChange={(val: any) => setCategory(val)}
              >
                <SelectTrigger id="category" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-card border border-border">
                  <SelectItem value="general" className="text-sm">General</SelectItem>
                  <SelectItem value="subscription" className="text-sm">Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalAmount" className="text-sm font-medium text-foreground">Total Amount (₱)</Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                required
                min="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transactionDate" className="text-sm font-medium text-foreground">Date</Label>
              <Input
                id="transactionDate"
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Members Split Checklist */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground block">Include in Split</Label>
            <div className="border border-border rounded-md bg-muted/10 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cohortMembers.map(member => {
                const isChecked = selectedMemberIds.includes(member.userId)
                return (
                  <label key={member.userId} className="flex items-center gap-2 text-sm font-sans p-1.5 hover:bg-muted/30 rounded-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleMember(member.userId)}
                      className="h-4 w-4 border-input rounded text-primary focus:ring-primary"
                    />
                    <span className="text-foreground">{member.username} {member.userId === currentUserId && '(You)'}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Split Mode Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">Split Mode</Label>
              <Tabs
                value={splitMode}
                onValueChange={(val: any) => setSplitMode(val)}
                className="w-auto"
              >
                <TabsList className="bg-muted border border-border h-8 rounded-md p-0.5">
                  <TabsTrigger value="equal" className="rounded-sm px-3 py-0.5 text-xs font-medium">Equal Split</TabsTrigger>
                  <TabsTrigger value="custom" className="rounded-sm px-3 py-0.5 text-xs font-medium">Custom Split</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Split Breakdown */}
            <div className="border border-border rounded-md bg-card overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="p-3 font-heading font-medium text-foreground">Member</th>
                    <th className="p-3 text-right font-heading font-medium text-foreground">Share (₱)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cohortMembers.map(member => {
                    const isInSplit = selectedMemberIds.includes(member.userId)
                    
                    if (!isInSplit) {
                      return (
                        <tr key={member.userId} className="text-muted-foreground bg-muted/5">
                          <td className="p-3 font-sans">{member.username}</td>
                          <td className="p-3 text-right font-sans italic text-xs">Excluded</td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={member.userId} className="bg-background">
                        <td className="p-3 font-sans font-medium text-foreground">
                          {member.username} {member.userId === currentUserId && '(You)'}
                        </td>
                        <td className="p-3 text-right font-sans">
                          {splitMode === 'equal' ? (
                            <span className="font-medium text-foreground tabular-nums">
                              ₱{calculatedSplits[member.userId] || '0.00'}
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-muted-foreground text-xs">₱</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={customAmounts[member.userId] || ''}
                                onChange={(e) => handleCustomAmountChange(member.userId, e.target.value)}
                                placeholder="0.00"
                                className="w-24 text-right bg-background border border-input rounded-sm px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Sum Checking / Balance alert for custom mode */}
            {splitMode === 'custom' && (
              <div className="flex items-center justify-between text-xs font-sans px-1">
                <span className="text-muted-foreground">
                  Sum of splits: <span className="font-semibold text-foreground">₱{(sumOfSplitsCents / 100).toFixed(2)}</span> / ₱{currentAmount.toFixed(2)}
                </span>
                {isSumMatching ? (
                  <span className="text-owed font-semibold">Matched exactly</span>
                ) : (
                  <span className="text-owe font-semibold">
                    {difference > 0 ? `Needs ₱${difference.toFixed(2)} more` : `Exceeds by ₱${Math.abs(difference).toFixed(2)}`}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/cohorts/${cohortId}`)}
              className="border border-border text-foreground hover:bg-muted font-medium py-2 px-4 rounded-md flex items-center gap-1.5"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || (splitMode === 'custom' && !isSumMatching)}
              className="bg-primary text-primary-foreground hover:opacity-90 font-medium py-2 px-4 rounded-md flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              {isPending ? 'Saving...' : 'Save Expense'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
