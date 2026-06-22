import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { LogOut, LayoutDashboard, User, Users, PlusCircle } from 'lucide-react'

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
      {/* Header Navigation (Desktop only) */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card">
        <div className="mx-auto w-full max-w-7xl px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-lg font-heading font-bold text-foreground tracking-tight hover:opacity-80 animate-fade-in"
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
                className="text-muted-foreground hover:text-foreground p-2 h-auto cursor-pointer"
                title="Log Out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4 mt-auto mb-16 md:mb-0">
        <div className="mx-auto w-full max-w-7xl px-4 text-center text-xs text-muted-foreground font-sans">
          &copy; {new Date().getFullYear()} SubSqueeze. Household ledger tool.
        </div>
      </footer>

      {/* Sticky Bottom Navigation (Mobile Viewports) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex justify-around items-center h-16 shadow-lg">
        <Link
          href="/dashboard"
          className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-muted-foreground hover:text-foreground transition-colors"
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[10px] font-medium font-sans">Ledger</span>
        </Link>
        <Link
          href="/dashboard#cohorts"
          className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-muted-foreground hover:text-foreground transition-colors"
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px] font-medium font-sans">Groups</span>
        </Link>
        <Link
          href="/dashboard"
          className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-primary hover:opacity-80 transition-colors"
        >
          <PlusCircle className="h-5 w-5 text-primary" />
          <span className="text-[10px] font-medium font-sans text-primary">Add</span>
        </Link>
        <form action={logoutAction} className="flex-1 h-full flex items-center justify-center">
          <button
            type="submit"
            className="flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[10px] font-medium font-sans">Log Out</span>
          </button>
        </form>
      </nav>
    </div>
  )
}
