import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
})

export const signupSchema = z.object({
  username: z.string()
    .min(3, { message: 'Username must be at least 3 characters' })
    .max(20, { message: 'Username must not exceed 20 characters' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
})

export const createCohortSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }).max(50),
  description: z.string().max(200).optional().or(z.literal('')),
})

export const joinCohortSchema = z.object({
  invite_code: z.string().min(8, { message: 'Invite code must be at least 8 characters' }).max(12),
})

export const expenseSplitSchema = z.object({
  user_id: z.string().uuid(),
  amount_owed: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Amount must be a valid number with up to 2 decimal places' }),
})

export const expenseSchema = z.object({
  description: z.string().min(3, { message: 'Description must be at least 3 characters' }).max(100),
  category: z.enum(['subscription', 'general']),
  total_amount: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Amount must be a valid number with up to 2 decimal places' })
    .refine((val) => parseFloat(val) > 0, { message: 'Amount must be greater than 0' }),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' }),
  split_mode: z.enum(['equal', 'custom']),
  // A mapping of user_id -> amount_owed string
  splits: z.array(expenseSplitSchema),
})

export const settlementSchema = z.object({
  payee_id: z.string().uuid({ message: 'Invalid payee' }),
  cohort_id: z.string().uuid({ message: 'Invalid cohort' }),
  amount_paid: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Amount must be a valid number with up to 2 decimal places' })
    .refine((val) => parseFloat(val) > 0, { message: 'Amount must be greater than 0' }),
  settlement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' }),
})
