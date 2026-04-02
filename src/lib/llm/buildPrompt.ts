/**
 * buildPrompt.ts
 *
 * Assembles the final LLM prompt from pre-built context objects.
 * Designed for GPT-4o-mini / Gemini Flash — structured JSON output.
 * Target total: ~1,200 tokens input, ~400 tokens output.
 */

import type { FlightContext } from './buildFlightContext'
import type { PromoContext } from './buildPromoContext'
import type { UserContext } from './buildUserContext'
import { flightContextToString } from './buildFlightContext'
import { promoContextToString } from './buildPromoContext'
import { userContextToString } from './buildUserContext'

export interface TransferPathDetail {
    source: string
    saldo_usuario: number
    ratio_base: number
    promo_bonus_pct: number
    ratio_efetivo: number
    milhas_resultantes: number
    custo_efetivo_por_mil: number
    promo_label: string | null
}

export interface ProgramComparison {
    programa: string
    milhas_necessarias: number
    saldo_direto: number
    transferencias: TransferPathDetail[]
    total_potencial: number
    deficit: number
    custo_compra_milhas_brl: number
    promo_compra_ativa: string | null
    custo_efetivo_por_mil: number
    taxas_estimadas_brl: number
    custo_total_brl: number
    economia_vs_cash_brl: number
    economia_vs_cash_pct: number
    cpm: number
    melhor_opcao: boolean
    disponibilidade_confirmada: boolean
}

export interface StrategyResult {
    vale_a_pena: boolean               // false = dinheiro é mais vantajoso
    cpm_resgate: number                // centavos por milha, ex: 2.50
    cpm_avaliacao: string              // "EXCELENTE" | "MUITO BOM" | "BOM" | "RAZOÁVEL" | "RUIM"
    programa_recomendado: string       // "Smiles"
    motivo: string                     // max 3 sentences explaining cost difference
    steps: string[]                    // 3-4 actionable steps (title only)
    step_details: string[]             // one paragraph per step explaining in detail for beginners
    milhas_necessarias: number         // ex: 70000
    milhas_em_carteira?: number        // direct balance in the target program
    milhas_faltantes?: number          // deficit after direct balance + transfers
    como_completar_faltantes?: string  // how to get the missing miles
    taxas_estimadas_brl: number        // ex: 280 — só as taxas aeroportuárias
    custo_total_estrategia?: number    // compra de milhas + taxas = custo REAL "com milhas"
    economia_pct: number               // ex: 68
    economia_brl?: number              // cashPrice - custo_total_estrategia
    promocao_ativa?: string            // "Bônus 40% Smiles via Nubank (expira 15/03)"
    alternativa?: string               // second cheapest program from comparison
    aviso?: string                     // any important disclaimer
    regras_promocoes?: string[]        // list of rules/warnings about promos used in the strategy
    comparacao_programas?: ProgramComparison[]  // server-computed multi-program cost breakdown
}

export const SYSTEM_PROMPT = `Você é FlyWise, um especialista em programas de fidelidade e milhas aéreas do Brasil.
Sua função é analisar um voo específico e gerar a melhor estratégia para emiti-lo usando milhas.
Responda SEMPRE em JSON válido, sem texto fora do JSON. Seja direto e prático.`

export function buildPrompt(
    flight: FlightContext,
    promos: PromoContext[],
    user: UserContext | null,
): string {
    const sections: string[] = []

    sections.push('=== VOO SELECIONADO ===')
    sections.push(flightContextToString(flight))

    sections.push('\n=== PROMOÇÕES ATIVAS ===')
    sections.push(promoContextToString(promos))

    if (user) {
        sections.push('\n=== SALDO DO USUÁRIO ===')
        sections.push(userContextToString(user))
    }

    sections.push(`
=== RESPONDA EM JSON EXATAMENTE NESTE FORMATO ===
{
  "programa_recomendado": "<Smiles | LATAM Pass | TudoAzul | Livelo | ...>",
  "motivo": "<máx 2 frases explicando por quê este programa>",
  "steps": [
    "<passo 1: como obter/transferir milhas>",
    "<passo 2: como emitir o bilhete>",
    "<passo 3: dica de timing ou promoção a aproveitar>"
  ],
  "milhas_necessarias": <número inteiro>,
  "taxas_estimadas_brl": <número inteiro>,
  "economia_pct": <percentual de economia vs preço cash, inteiro>,
  "promocao_ativa": "<se houver promoção relevante, descreva brevemente ou null>",
  "alternativa": "<segundo programa recomendado ou null>",
  "aviso": "<aviso importante se houver, ou null>"
}`)

    return sections.join('\n')
}

/**
 * Estimate token count (rough: 1 token ≈ 4 chars)
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}
