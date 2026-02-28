/**
 * buildUserContext.ts
 *
 * Fetches the authenticated user's miles balances from Supabase.
 * Allows the LLM to say "you already have 95k Smiles — enough for this flight".
 * Target: ~100 tokens.
 */

import { supabase } from '@/lib/supabase'

export interface UserBalance {
    program: string
    points: number
}

export interface UserContext {
    userId: string
    balances: UserBalance[]
    hasEnoughFor?: {                // pre-computed convenience
        program: string
        points: number
        needed: number
    }[]
}

/**
 * Load user mile balances. Returns null if user has no wallet data.
 * Uses buscas.user_miles JSONB as the source.
 */
export async function buildUserContext(
    userId: string,
    neededMilesEst: number,
): Promise<UserContext | null> {
    try {
        // user_miles is stored in buscas as JSONB: { "Smiles": 95000, "Livelo": 32000 }
        const { data } = await supabase
            .from('buscas')
            .select('user_miles')
            .eq('user_id', userId)
            .not('user_miles', 'eq', '{}')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!data?.user_miles) return null

        const rawMiles = data.user_miles as Record<string, number>
        const balances: UserBalance[] = Object.entries(rawMiles)
            .filter(([, pts]) => pts > 0)
            .map(([program, points]) => ({ program, points }))
            .sort((a, b) => b.points - a.points) // highest balance first

        if (!balances.length) return null

        const hasEnoughFor = balances
            .filter(b => b.points >= neededMilesEst * 0.7) // at least 70% of what's needed
            .map(b => ({ program: b.program, points: b.points, needed: neededMilesEst }))

        return { userId, balances, hasEnoughFor }
    } catch { return null }
}

/** Serialize to compact string for prompt — ~100 tokens */
export function userContextToString(ctx: UserContext | null): string {
    if (!ctx || !ctx.balances.length) return 'Usuário sem saldo de milhas cadastrado.'
    const lines = ctx.balances.map(b =>
        `${b.program}: ${b.points.toLocaleString('pt-BR')} pts`
    )
    return 'Saldo atual: ' + lines.join(' | ')
}
