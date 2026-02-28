/**
 * buildPromoContext.ts
 *
 * Fetches and filters promotions relevant to a given set of miles programs.
 * Returns max 5 promos, sorted by urgency, in a compact format.
 * Target: ~500 tokens instead of ~10,000 for full promo list.
 */

import { supabase } from '@/lib/supabase'

export interface PromoContext {
    program: string     // "Smiles"
    type: string        // "bonus_transferencia"
    summary: string     // "40% bônus via Nubank"
    expires?: string    // "15/03/2025"
    source?: string     // "passageirodeprimeira.com.br"
    bonusPct?: number   // 40
    parceiro?: string   // "Nubank"
}

const MAX_PROMOS = 5

/**
 * Query promos from Supabase filtered by the programs compatible with the flight.
 * Falls back to returning generic recent promos if none match the programs.
 */
export async function buildPromoContext(programs: string[]): Promise<PromoContext[]> {
    try {
        // Try to get program-specific promos first
        if (programs.length > 0) {
            const { data: specific } = await supabase
                .from('promocoes')
                .select('titulo, conteudo, programa, tipo, bonus_pct, parceiro, valid_until, fonte')
                .in('programa', programs)
                .or('valid_until.is.null,valid_until.gt.' + new Date().toISOString())
                .order('valid_until', { ascending: true, nullsFirst: false })
                .limit(MAX_PROMOS)

            if (specific && specific.length > 0) {
                return specific.map(mapPromo)
            }
        }

        // Fallback: most recent promos regardless of program
        const { data: recent } = await supabase
            .from('vw_promocoes_ativas')
            .select('titulo, conteudo, programa, tipo, bonus_pct, parceiro, valid_until, fonte')
            .limit(MAX_PROMOS)

        return (recent ?? []).map(mapPromo)
    } catch (err) {
        console.warn('[buildPromoContext] Error fetching promos:', err)
        return []
    }
}

function mapPromo(row: any): PromoContext {
    // Try to extract expiry date nicely
    let expires: string | undefined
    if (row.valid_until) {
        try {
            expires = new Date(row.valid_until).toLocaleDateString('pt-BR')
        } catch { /* ignore */ }
    }

    // Build summary from titulo or conteudo (truncate to 120 chars)
    const rawSummary = row.titulo ?? row.conteudo ?? ''
    const summary = rawSummary.length > 120 ? rawSummary.slice(0, 117) + '...' : rawSummary

    return {
        program: row.programa ?? 'Geral',
        type: row.tipo ?? 'promocao',
        summary,
        expires,
        source: row.fonte,
        bonusPct: row.bonus_pct,
        parceiro: row.parceiro,
    }
}

/** Serialize to compact string for prompt — ~500 tokens for 5 promos max */
export function promoContextToString(promos: PromoContext[]): string {
    if (!promos.length) return 'Nenhuma promoção ativa no banco.'
    return promos.map((p, i) => {
        const parts = [`${i + 1}. ${p.program}`]
        if (p.bonusPct) parts.push(`+${p.bonusPct}% bônus`)
        if (p.parceiro) parts.push(`via ${p.parceiro}`)
        parts.push(`— ${p.summary}`)
        if (p.expires) parts.push(`(expira ${p.expires})`)
        return parts.join(' ')
    }).join('\n')
}
