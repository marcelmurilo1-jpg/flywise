/**
 * buildPromoContext.ts
 *
 * Fetches promotions relevant to a given set of miles programs.
 * Handles both manually-seeded promos (programa field) and scraped promos
 * (programas_tags array). Also surfaces passagens promotions for route context.
 * Returns max 6 promos in a compact format (~500 tokens).
 */

import { supabase } from '@/lib/supabase'

export interface PromoContext {
    program: string     // "Smiles" | "Passagens" | "Geral"
    type: string        // "bonus_transferencia" | "clube" | "passagem" | "promocao"
    summary: string     // first 120 chars of titulo
    expires?: string    // "15/03/2025"
    source?: string     // "passageirodeprimeira.com.br"
    bonusPct?: number   // 40
    parceiro?: string   // "Nubank"
    categoria?: string  // "milhas" | "passagens"
}

const MAX_PROMOS = 6

const SELECT = 'titulo, conteudo, programa, tipo, bonus_pct, parceiro, valid_until, fonte, categoria, subcategoria, programas_tags'

// Tags de bancos/cartões — não são o programa de fidelidade em si
const BANK_TAGS = new Set(['Nubank', 'Itaú', 'Livelo', 'C6', 'Inter', 'Santander', 'Bradesco', 'Amex', 'Caixa', 'BTG', 'XP', 'Diners'])

/**
 * Query promos from Supabase filtered by the programs compatible with the flight.
 * Handles both manual (programa field) and scraped (programas_tags) promos.
 * Always appends recent passagens promotions for route context.
 */
export async function buildPromoContext(programs: string[]): Promise<PromoContext[]> {
    try {
        const now = new Date().toISOString()
        const validFilter = `valid_until.is.null,valid_until.gt.${now}`

        const fetches: Promise<{ data: unknown[] | null }>[] = []

        // Q1: promos manuais com campo `programa` preenchido
        if (programs.length > 0) {
            fetches.push(
                supabase.from('vw_promocoes_ativas')
                    .select(SELECT)
                    .in('programa', programs)
                    .or(validFilter)
                    .order('valid_until', { ascending: true, nullsFirst: false })
                    .limit(MAX_PROMOS) as Promise<{ data: unknown[] | null }>
            )
        }

        // Q2: promos do scraper com `programas_tags` (array overlap)
        if (programs.length > 0) {
            fetches.push(
                supabase.from('vw_promocoes_ativas')
                    .select(SELECT)
                    .overlaps('programas_tags', programs)
                    .or(validFilter)
                    .order('valid_until', { ascending: true, nullsFirst: false })
                    .limit(MAX_PROMOS) as Promise<{ data: unknown[] | null }>
            )
        }


        const results = await Promise.all(fetches)

        // Mescla e deduplica por título
        const seen = new Set<string>()
        const merged: Record<string, unknown>[] = []
        for (const { data } of results) {
            for (const row of (data ?? []) as Record<string, unknown>[]) {
                const key = String(row.titulo ?? '').slice(0, 60).toLowerCase()
                if (!seen.has(key)) {
                    seen.add(key)
                    merged.push(row)
                }
            }
        }

        if (merged.length > 0) {
            return merged.slice(0, MAX_PROMOS).map(mapPromo)
        }

        // Fallback: promos mais recentes sem filtro de programa
        const { data: recent } = await supabase
            .from('vw_promocoes_ativas')
            .select(SELECT)
            .limit(MAX_PROMOS)

        return ((recent ?? []) as Record<string, unknown>[]).map(mapPromo)
    } catch (err) {
        console.warn('[buildPromoContext] Error fetching promos:', err)
        return []
    }
}

function mapPromo(row: Record<string, unknown>): PromoContext {
    let expires: string | undefined
    if (row.valid_until) {
        try { expires = new Date(row.valid_until as string).toLocaleDateString('pt-BR') } catch { /* ignore */ }
    }

    const rawSummary = String(row.titulo ?? row.conteudo ?? '')
    const summary = rawSummary.length > 120 ? rawSummary.slice(0, 117) + '...' : rawSummary

    // Programa: usa campo `programa` ou extrai de `programas_tags` (primeiro tag que não é banco)
    const tags = (row.programas_tags as string[] | null) ?? []
    const programFromTags = tags.find(t => !BANK_TAGS.has(t)) ?? tags[0] ?? null
    const bancoTag = tags.find(t => BANK_TAGS.has(t)) ?? null

    // Tipo: normaliza a partir de `tipo` ou `subcategoria` ou `categoria`
    let type = String(row.tipo ?? '')
    if (!type) {
        if (row.subcategoria === 'transferencia') type = 'bonus_transferencia'
        else if (row.subcategoria === 'clube') type = 'clube'
        else if (row.categoria === 'passagens') type = 'passagem'
        else type = 'promocao'
    }

    // bonus_pct: usa campo ou extrai do título (ex: "40% bônus")
    let bonusPct = row.bonus_pct as number | undefined
    if (!bonusPct && row.titulo) {
        const m = String(row.titulo).match(/\+?\s*(\d{2,3})\s*%/)
        if (m) bonusPct = parseInt(m[1], 10)
    }

    const program = String(
        row.programa ??
        programFromTags ??
        (row.categoria === 'passagens' ? 'Passagens' : 'Geral')
    )

    return {
        program,
        type,
        summary,
        expires,
        source: row.fonte as string | undefined,
        bonusPct: bonusPct || undefined,
        parceiro: (row.parceiro as string | undefined) ?? bancoTag ?? undefined,
        categoria: row.categoria as string | undefined,
    }
}

/** Serializa para string compacta no prompt — ~500 tokens para 6 promos */
export function promoContextToString(promos: PromoContext[]): string {
    if (!promos.length) return 'Nenhuma promoção ativa no banco.'
    return promos.map((p, i) => formatPromoLine(p, i + 1)).join('\n')
}

function formatPromoLine(p: PromoContext, i: number): string {
    const parts = [`  ${i}. [${p.type}] ${p.program}`]
    if (p.bonusPct) parts.push(`+${p.bonusPct}% bônus`)
    if (p.parceiro) parts.push(`via ${p.parceiro}`)
    parts.push(`— ${p.summary}`)
    if (p.expires) parts.push(`(expira ${p.expires})`)
    return parts.join(' ')
}
