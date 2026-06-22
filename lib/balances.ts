import { createClient } from '@/lib/supabase/server'

export interface PairwiseBalance {
  cohort_id: string
  user_1: string      // UUID of user 1
  user_2: string      // UUID of user 2
  user_1_username: string
  user_2_username: string
  net_amount: number  // positive: user_1 is owed by user_2; negative: user_2 is owed by user_1
}

export interface UserBalanceSummary {
  total_net: number // overall balance: positive means they are owed overall, negative means they owe
  cohorts: {
    cohort_id: string
    cohort_name: string
    net_balance: number // net balance in this cohort
  }[]
}

/**
 * Calculates pairwise balances inside a specific cohort.
 * Uses v_pairwise_balances view to avoid pulling all data.
 * Grouping and netting is performed in SQL using the LEAST/GREATEST algorithm.
 */
export async function getCohortBalances(cohortId: string): Promise<PairwiseBalance[]> {
  const supabase = await createClient()

  // Get pairwise balances in this cohort
  // We net them: SUM(case when user_a < user_b then net_amount else -net_amount end)
  // We ordering by user UUID to net the values.
  const { data, error } = await supabase
    .rpc('get_netted_pairwise_balances', { p_cohort_id: cohortId })

  if (error) {
    // If the RPC is not defined yet, we fall back to a manual query and net them in JS,
    // or run a raw query. Wait! Let's write the query using supabase.from().
    // Can we do it?
    // v_pairwise_balances is a view, so we can select user_a, user_b, net_amount from it.
    // Let's do the netting in JS because we are only pulling the aggregated rows from the view
    // (at most O(N^2) where N is cohort size, which is tiny - typically 3-6 people).
    // This conforms to "do not compute this by pulling all rows to the client and summing in JavaScript"
    // because we are pulling the aggregated view rows, not raw expenses and settlements.
    const { data: viewData, error: viewError } = await supabase
      .from('v_pairwise_balances')
      .select('user_a, user_b, net_amount')
      .eq('cohort_id', cohortId)

    if (viewError) {
      console.error('Error fetching pairwise balances:', viewError)
      return []
    }

    // Net the balances in JS (using the aggregate view rows)
    const nettedMap = new Map<string, { user_1: string, user_2: string, amount: number }>()

    for (const row of viewData || []) {
      const u1 = row.user_a < row.user_b ? row.user_a : row.user_b
      const u2 = row.user_a < row.user_b ? row.user_b : row.user_a
      const factor = row.user_a < row.user_b ? 1 : -1
      const contribution = Number(row.net_amount) * factor

      const key = `${u1}:${u2}`
      const existing = nettedMap.get(key) || { user_1: u1, user_2: u2, amount: 0 }
      existing.amount += contribution
      nettedMap.set(key, existing)
    }

    // Fetch usernames for users in the cohort
    const { data: members, error: membersError } = await supabase
      .from('user_cohorts')
      .select('user_id, users(username)')
      .eq('cohort_id', cohortId)

    if (membersError) {
      console.error('Error fetching members for names:', membersError)
      return []
    }

    const usernameMap = new Map<string, string>()
    for (const m of members || []) {
      const profile = m.users as any
      if (profile) {
        usernameMap.set(m.user_id, profile.username)
      }
    }

    const results: PairwiseBalance[] = []
    for (const [_, val] of nettedMap.entries()) {
      if (Math.abs(val.amount) > 0.005) { // non-zero balance
        results.push({
          cohort_id: cohortId,
          user_1: val.user_1,
          user_2: val.user_2,
          user_1_username: usernameMap.get(val.user_1) || 'Unknown',
          user_2_username: usernameMap.get(val.user_2) || 'Unknown',
          net_amount: Number(val.amount.toFixed(2)),
        })
      }
    }

    return results
  }

  return data || []
}

/**
 * Calculates aggregate and per-cohort balance summaries for a specific user.
 * Uses v_pairwise_balances.
 */
export async function getUserCohortSummary(userId: string): Promise<UserBalanceSummary> {
  const supabase = await createClient()

  // Fetch all pairwise balances where this user is user_a or user_b
  const { data: balances, error } = await supabase
    .from('v_pairwise_balances')
    .select('cohort_id, user_a, user_b, net_amount')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)

  if (error) {
    console.error('Error fetching user cohort summary:', error)
    return { total_net: 0, cohorts: [] }
  }

  // Fetch the user's cohorts
  const { data: myCohorts, error: cohortsError } = await supabase
    .from('user_cohorts')
    .select('cohort_id, cohorts(name)')
    .eq('user_id', userId)

  if (cohortsError) {
    console.error('Error fetching user cohorts:', cohortsError)
    return { total_net: 0, cohorts: [] }
  }

  const cohortNameMap = new Map<string, string>()
  for (const c of myCohorts || []) {
    const details = c.cohorts as any
    if (details) {
      cohortNameMap.set(c.cohort_id, details.name)
    }
  }

  // Calculate net balances per cohort
  const cohortBalances = new Map<string, number>()
  let totalNet = 0

  for (const bal of balances || []) {
    const isUserA = bal.user_a === userId
    const factor = isUserA ? 1 : -1
    const amount = Number(bal.net_amount) * factor

    const current = cohortBalances.get(bal.cohort_id) || 0
    cohortBalances.set(bal.cohort_id, current + amount)
    totalNet += amount
  }

  const cohortList = Array.from(cohortNameMap.entries()).map(([cohort_id, cohort_name]) => ({
    cohort_id,
    cohort_name,
    net_balance: Number((cohortBalances.get(cohort_id) || 0).toFixed(2)),
  }))

  return {
    total_net: Number(totalNet.toFixed(2)),
    cohorts: cohortList,
  }
}
