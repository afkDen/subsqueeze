import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { LogOut, LayoutDashboard, User } from 'lucide-react'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Fetch current user and profile
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Fetch user profile from public.users
  const { data: profile } = await supabase
    .from('users')
    .select('username, email')
    .eq('id', user.id)
    .single()

  const displayName = profile?.username || user.email?.split('@')[0] || 'User'

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card">
        <div className="mx-auto w-full max-w-7xl px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-lg font-heading font-bold text-foreground tracking-tight hover:opacity-80"
            >
              SubSqueeze
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-foreground/80 hover:text-foreground transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{displayName}</span>
            </div>
            
            <form action={logoutAction}>
              <Button
                variant="ghost"
                type="submit"
                className="text-muted-foreground hover:text-foreground p-2 h-auto"
                title="Log Out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4 mt-auto">
        <div className="mx-auto w-full max-w-7xl px-4 text-center text-xs text-muted-foreground font-sans">
          &copy; {new Date().getFullYear()} SubSqueeze. Household ledger tool.
        </div>
      </footer>
    </div>
  )
}
