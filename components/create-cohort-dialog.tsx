'use client'

import { useState, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createCohort } from '@/lib/actions/cohorts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Info } from 'lucide-react'
import { toast } from 'sonner'

export function CreateCohortDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createCohort, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.success && state?.cohortId) {
      setOpen(false)
      toast.success('Cohort created successfully!')
      router.push(`/cohorts/${state.cohortId}`)
    }
  }, [state, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="bg-primary text-primary-foreground hover:opacity-90 font-medium py-2 px-4 rounded-md transition-opacity flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Cohort
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px] border border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-semibold text-foreground">Create Cohort</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new household or digital subscription splitting group.
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
            <Label htmlFor="name" className="text-sm font-medium text-foreground">Cohort Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g., Apartment 4B, Netflix Split"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-foreground">Description (Optional)</Label>
            <Input
              id="description"
              name="description"
              type="text"
              placeholder="e.g., Monthly billing split"
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
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
