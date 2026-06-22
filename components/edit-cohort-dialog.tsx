'use client'

import { useState, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateCohort } from '@/lib/actions/cohorts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Edit2, Info } from 'lucide-react'
import { toast } from 'sonner'

interface EditCohortDialogProps {
  cohortId: string
  initialName: string
  initialDescription?: string | null
  initialBudgetLimit?: number | null
}

export function EditCohortDialog({ cohortId, initialName, initialDescription, initialBudgetLimit }: EditCohortDialogProps) {
  const [open, setOpen] = useState(false)
  const updateCohortAction = updateCohort.bind(null, cohortId)
  const [state, formAction, isPending] = useActionState(updateCohortAction, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.success) {
      setOpen(false)
      toast.success('Cohort updated successfully!')
      router.refresh()
    }
  }, [state, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" className="border border-border text-foreground hover:bg-muted font-medium py-2 px-4 rounded-md transition-colors flex items-center gap-1.5">
          <Edit2 className="h-4 w-4" />
          Edit Details
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px] border border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-semibold text-foreground">Edit Cohort Details</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update settings and set a monthly budget limit.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4 pt-4">
          {state?.error && (
            <Alert variant="destructive" className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <AlertDescription className="text-sm font-sans">{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-sm font-medium text-foreground">Cohort Name</Label>
            <Input
              id="edit-name"
              name="name"
              type="text"
              required
              defaultValue={initialName}
              placeholder="e.g., Apartment 4B, Netflix Split"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description" className="text-sm font-medium text-foreground">Description (Optional)</Label>
            <Input
              id="edit-description"
              name="description"
              type="text"
              defaultValue={initialDescription || ''}
              placeholder="e.g., Monthly billing split"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-budget" className="text-sm font-medium text-foreground">Monthly Budget Limit (₱, Optional)</Label>
            <Input
              id="edit-budget"
              name="budget_limit"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={initialBudgetLimit ? initialBudgetLimit.toFixed(2) : ''}
              placeholder="e.g., 5000.00"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
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
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
