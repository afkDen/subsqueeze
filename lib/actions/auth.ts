'use server'

import { createClient } from '@/lib/supabase/server'
import { loginSchema, signupSchema } from '@/lib/validations'
import { redirect } from 'next/navigation'

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const validated = loginSchema.safeParse({ email, password })
  if (!validated.success) {
    return {
      error: validated.error.issues.map(e => e.message).join(', '),
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signupAction(prevState: any, formData: FormData) {
  const username = formData.get('username') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const validated = signupSchema.safeParse({ username, email, password })
  if (!validated.success) {
    return {
      error: validated.error.issues.map(e => e.message).join(', '),
    }
  }

  const supabase = await createClient()

  // On sign-up, a row in public.users is auto-created by the database trigger.
  // We pass 'username' in options.data so the trigger extracts it correctly.
  const { error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      data: {
        username: validated.data.username,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
