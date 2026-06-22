'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, LogIn, CheckCircle2, Calendar, Wallet } from 'lucide-react'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null)

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-12 bg-background">
      {/* Left Column: Brand & Marketing (Desktop only) */}
      <div className="hidden md:flex md:col-span-6 lg:col-span-7 bg-[#1B1F23] text-[#FAF9F6] flex-col justify-between p-12 relative overflow-hidden border-r border-[#2E333A]">
        {/* Ambient background blur spots based on credit/debit palette */}
        <div className="absolute top-1/4 -left-10 w-72 h-72 rounded-full bg-[#2F6F4F]/10 blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-10 w-96 h-96 rounded-full bg-[#A8442F]/10 blur-3xl"></div>

        <div className="relative z-10">
          <span className="text-xl font-heading font-extrabold tracking-tight">
            SubSqueeze
          </span>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <h2 className="text-4xl lg:text-5xl font-heading font-extrabold tracking-tight leading-tight">
            Squeeze the most out of your subscriptions.
          </h2>
          <p className="text-[#9da3ae] text-base lg:text-lg max-w-md font-sans">
            The reliable digital subscription ledger and household expense splitter for university dormmates and co-tenants.
          </p>

          <div className="space-y-5 pt-6">
            <div className="flex items-start gap-4">
              <div className="bg-[#FAF9F6]/10 p-2 rounded-sm text-[#2F6F4F] mt-0.5 shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Netted Pairwise Balances</h4>
                <p className="text-xs text-[#9da3ae] font-sans mt-0.5">We calculate the shortest path to settle outstanding peer debts automatically.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-[#FAF9F6]/10 p-2 rounded-sm text-[#FAF9F6] mt-0.5 shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Household Budgets</h4>
                <p className="text-xs text-[#9da3ae] font-sans mt-0.5">Set cohort monthly limits and track collective spend progress in real-time.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-[#FAF9F6]/10 p-2 rounded-sm text-[#A8442F] mt-0.5 shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Renewal Reminders</h4>
                <p className="text-xs text-[#9da3ae] font-sans mt-0.5">Keep track of upcoming billing due dates and category details in the cohort feed.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-[#9da3ae] font-sans">
          &copy; {new Date().getFullYear()} SubSqueeze. Household ledger tool.
        </div>
      </div>

      {/* Right Column: Auth Form */}
      <div className="col-span-1 md:col-span-6 lg:col-span-5 flex items-center justify-center p-8 sm:p-12 bg-card relative">
        {/* Soft background glow for mobile viewports */}
        <div className="md:hidden absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#2F6F4F]/5 blur-3xl"></div>
        
        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="md:hidden text-center mb-6">
            <h1 className="text-3xl font-heading font-extrabold tracking-tight text-foreground">
              SubSqueeze
            </h1>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              Shared expense & subscription ledger
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">Welcome Back</h3>
            <p className="text-sm text-muted-foreground font-sans">
              Enter your credentials to access your household ledger accounts.
            </p>
          </div>

          <form action={formAction} className="space-y-5">
            {state?.error && (
              <Alert variant="destructive" className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 flex items-start gap-2 animate-shake">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <AlertDescription className="text-sm font-sans">{state.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-foreground">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="name@example.com"
                className="w-full bg-background border border-input rounded-md px-3.5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-foreground">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-background border border-input rounded-md px-3.5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary text-primary-foreground hover:opacity-90 font-medium py-3.5 rounded-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer shadow-md mt-6"
            >
              <LogIn className="h-4 w-4" />
              {isPending ? 'Signing In...' : 'Sign In'}
            </Button>

            <div className="text-center text-sm font-sans pt-2">
              <span className="text-muted-foreground">Don&apos;t have an account? </span>
              <Link
                href="/signup"
                className="font-semibold text-primary hover:underline"
              >
                Create one
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
