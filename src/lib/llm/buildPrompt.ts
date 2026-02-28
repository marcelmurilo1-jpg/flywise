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

export interface StrategyResult {
    programa_recomendado: string       // "Smiles"
    motivo: string                     // max 2 sentences
    steps: string[]                    // 3 actionable steps
    milhas_necessarias: number         // ex: 120000
    taxas_estimadas_brl: number        // ex: 280
    economia_pct: number               // ex: 68
    promocao_ativa?: string            // "Bônus 40% Smiles via Nubank (expira 15/03)"
    alternativa?: string               // fallback program if main is not available
    aviso?: string                     // any important disclaimer
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
