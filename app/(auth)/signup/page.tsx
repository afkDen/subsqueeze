'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signupAction } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, UserPlus } from 'lucide-react'

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, null)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-heading font-extrabold tracking-tight text-foreground">
            SubSqueeze
          </h1>
          <p className="mt-3 text-sm text-muted-foreground font-sans max-w-xs mx-auto">
            The reliable digital subscription ledger and household expense splitter.
          </p>
        </div>

        <Card className="border border-border bg-card shadow-[0px_4px_20px_rgba(15,23_42,_0.05)] rounded-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-heading font-bold text-foreground">Create Account</CardTitle>
            <CardDescription className="text-sm text-muted-foreground font-sans">
              Sign up for digital subscription splits and household logging.
            </CardDescription>
          </CardHeader>
          <form action={formAction}>
            <CardContent className="space-y-4">
              {state?.error && (
                <Alert variant="destructive" className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 flex items-start gap-2 animate-shake">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <AlertDescription className="text-sm font-sans">{state.error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-foreground">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="johndoe"
                  className="w-full bg-background border border-input rounded-md px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground font-sans">
                  Letters, numbers, and underscores only.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-foreground">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="w-full bg-background border border-input rounded-md px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
                  className="w-full bg-background border border-input rounded-md px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2 pb-6">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-primary text-primary-foreground hover:opacity-90 font-medium py-3 rounded-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                {isPending ? 'Creating Account...' : 'Create Account'}
              </Button>

              <div className="text-center text-sm font-sans">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link
                  href="/login"
                  className="font-semibold text-primary hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
