'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCohort } from '@/lib/actions/cohorts'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteCohortButtonProps {
  cohortId: string
  cohortName: string
}

export function DeleteCohortButton({ cohortId, cohortName }: DeleteCohortButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = async () => {
    const confirmText = `Are you sure you want to delete the entire cohort "${cohortName}"? This will permanently delete all membership records, expenses, and liability splits. This action cannot be undone.`
    
    if (!window.confirm(confirmText)) {
      return
    }

    startTransition(async () => {
      const res = await deleteCohort(cohortId)
      if (res.success) {
        toast.success(`Cohort "${cohortName}" deleted successfully.`)
        router.refresh()
        router.push('/dashboard')
      } else {
        toast.error(res.error || 'Failed to delete cohort. Check if database permissions allow deletion.')
      }
    })
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={handleDelete}
      className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 font-medium text-xs py-1 px-3 rounded-sm h-8"
      title="Delete Cohort"
    >
      <Trash2 className="h-3.5 w-3.5 mr-1" />
      Delete Cohort
    </Button>
  )
}
