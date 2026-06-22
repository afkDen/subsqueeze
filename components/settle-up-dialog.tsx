'use client'

import { useState, useActionState, useEffect } from 'react'
import { recordSettlement } from '@/lib/actions/settlements'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'

interface SettleUpDialogProps {
  cohortId: string
  payeeId: string
  payeeName: string
  suggestedAmount: number // positive amount they owe
}

export function SettleUpDialog({ cohortId, payeeId, payeeName, suggestedAmount }: SettleUpDialogProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(suggestedAmount.toFixed(2))
  const [settlementDate, setSettlementDate] = useState('')
  
  // Set default date client-side only (prevents hydration mismatch)
  useEffect(() => {
    setSettlementDate(new Date().toISOString().split('T')[0])
  }, [])

  // Create state for action
  const [state, formAction, isPending] = useActionState(async (prevState: any, formData: FormData) => {
    const rawAmount = formData.get('amount') as string
    const rawDate = formData.get('date') as string
    
    return await recordSettlement({
      payeeId,
      cohortId,
      amount: rawAmount,
      date: rawDate,
    })
  }, null)

  useEffect(() => {
    if (state?.success) {
      setOpen(false)
      toast.success('Settlement payment recorded!')
    }
  }, [state])

  // Reset amount when suggested changes or dialog opens
  useEffect(() => {
    if (open) {
      setAmount(suggestedAmount.toFixed(2))
    }
  }, [open, suggestedAmount])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline" className="border-border text-foreground hover:bg-muted font-medium text-xs py-1 px-3 rounded-sm h-8">
          Settle Up
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px] border border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-semibold text-foreground">Record Settlement</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Log a direct payment made to {payeeName}.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4 pt-4">
          {state?.error && (
            <Alert variant="destructive" className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <AlertDescription className="text-sm font-sans">{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Immutability Alert Warning */}
          <Alert className="bg-muted border border-border rounded-md p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <AlertDescription className="text-xs text-muted-foreground font-sans">
              <strong>Important Notice:</strong> Settlement records are immutable and cannot be changed or deleted after submission. If you make a mistake, you must record an offsetting settlement in the opposite direction.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="payee" className="text-sm font-medium text-foreground">Payee</Label>
            <Input
              id="payee"
              type="text"
              disabled
              value={payeeName}
              className="w-full bg-muted border border-input rounded-md px-3 py-2 text-sm text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium text-foreground">Amount Paid (₱)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              required
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium text-foreground">Payment Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              required
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border border-border text-foreground hover:bg-muted font-medium py-2 px-4 rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:opacity-90 font-medium py-2 px-4 rounded-md"
            >
              {isPending ? 'Recording...' : 'Confirm'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
