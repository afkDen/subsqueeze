import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans text-foreground">
      <p className="text-sm font-medium">Redirecting to ledger...</p>
    </div>
  )
}

