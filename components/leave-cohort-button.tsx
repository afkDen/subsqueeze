'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { leaveCohort } from '@/lib/actions/cohorts'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'

interface LeaveCohortButtonProps {
  cohortId: string
  isCreator: boolean
}

export function LeaveCohortButton({ cohortId, isCreator }: LeaveCohortButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleLeave = async () => {
    const message = isCreator
      ? 'Warning: You are the creator/admin of this cohort. If you leave, other members can still use it, but you will lose administrative access. Are you sure you want to leave?'
      : 'Are you sure you want to leave this cohort?'

    if (!window.confirm(message)) {
      return
    }

    startTransition(async () => {
      const res = await leaveCohort(cohortId)
      if (res.success) {
        toast.success('Successfully left the cohort.')
        router.push('/dashboard')
      } else {
        toast.error(res.error || 'Failed to leave cohort.')
      }
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleLeave}
      className="border border-border text-foreground hover:bg-muted font-medium text-xs py-1 px-3 rounded-sm h-8"
      title="Leave Cohort"
    >
      <LogOut className="h-3.5 w-3.5 mr-1" />
      Leave
    </Button>
  )
}
