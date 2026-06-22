'use client'

import { useState, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { joinCohort } from '@/lib/actions/cohorts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserPlus, Info } from 'lucide-react'
import { toast } from 'sonner'

export function JoinCohortDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(joinCohort, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.success && state?.cohortId) {
      setOpen(false)
      toast.success('Joined cohort successfully!')
      router.push(`/cohorts/${state.cohortId}`)
    }
  }, [state, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" className="border border-border text-foreground hover:bg-muted font-medium py-2 px-4 rounded-md transition-colors flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Join Cohort
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px] border border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-semibold text-foreground">Join Cohort</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter the 8-character invite code of the cohort you want to join.
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
            <Label htmlFor="invite_code" className="text-sm font-medium text-foreground">Invite Code</Label>
            <Input
              id="invite_code"
              name="invite_code"
              type="text"
              required
              placeholder="e.g., a8c2d9e1"
              maxLength={8}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase font-mono"
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
              {isPending ? 'Joining...' : 'Join'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
